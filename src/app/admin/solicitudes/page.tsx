import Link from 'next/link';
import { fontDisplay } from '@/lib/fonts';
import { formatLong, normalizeTime } from '@/lib/dates';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import type { AppointmentRow, WhatsappOutboxRow } from '@/types/database.types';

const RETRYABLE_STATUSES: Record<string, string[]> = {
  confirmation: ['confirmed', 'in_progress', 'completed'],
  cancellation: ['cancelled', 'cancelled_by_client'],
};

export default async function AdminRequestsPage() {
  const supabase = await createClient();
  const [{ data: pendingData }, { data: rangesData }] = await Promise.all([
    supabase
      .from('appointments')
      .select('*')
      .eq('status', 'pending')
      .order('appointment_date', { ascending: true })
      .order('appointment_time', { ascending: true })
      .limit(100),
    supabase.from('date_ranges').select('id, title'),
  ]);

  const pendingAppointments: AppointmentRow[] = pendingData ?? [];
  const rangeTitles = new Map((rangesData ?? []).map((range) => [range.id, range.title]));
  let failedMessages: WhatsappOutboxRow[] = [];
  let failedMessageLookupUnavailable = false;

  try {
    const serviceClient = createServiceClient();
    const { data, error } = await serviceClient
      .from('whatsapp_outbox')
      .select('*')
      .in('type', ['confirmation', 'cancellation'])
      .eq('status', 'failed')
      .is('resolved_at', null)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) failedMessageLookupUnavailable = true;
    else failedMessages = data ?? [];
  } catch {
    failedMessageLookupUnavailable = true;
  }

  const appointmentIds = [...new Set([
    ...pendingAppointments.map((appointment) => appointment.id),
    ...failedMessages
      .map((message) => message.appointment_id)
      .filter((id): id is string => Boolean(id)),
  ])];
  const { data: appointmentsData } = appointmentIds.length
    ? await supabase.from('appointments').select('*').in('id', appointmentIds)
    : { data: [] };
  const appointments = new Map(
    (appointmentsData ?? []).map((appointment) => [appointment.id, appointment as AppointmentRow])
  );
  const retryableMessages = failedMessages.filter((message) => {
    if (!message.appointment_id) return false;
    const appointment = appointments.get(message.appointment_id);
    return Boolean(appointment && RETRYABLE_STATUSES[message.type]?.includes(appointment.status));
  });

  return (
    <div className="max-w-4xl">
      <h1 className={`${fontDisplay.className} text-3xl text-[#2B2320]`}>
        Solicitudes por revisar
      </h1>
      <p className="mt-2 text-sm text-[#8A7D77]">
        Turnos pendientes de aprobación y mensajes que necesitan reintento.
      </p>

      {failedMessageLookupUnavailable && (
        <p className="mt-6 rounded-lg border border-[#E7D7A8] bg-[#FFF8E5] px-4 py-3 text-sm text-[#765D1B]">
          No se pudieron consultar los avisos de WhatsApp. Revisá la clave secreta de Supabase en el servidor.
        </p>
      )}

      {retryableMessages.length === 0 && pendingAppointments.length === 0 ? (
        <p className="mt-8 rounded-lg border border-dashed border-[#E2D6CF] bg-white/60 px-6 py-10 text-center text-sm text-[#8A7D77]">
          No hay solicitudes pendientes.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {retryableMessages.map((message) => {
            const appointment = message.appointment_id
              ? appointments.get(message.appointment_id)
              : undefined;
            if (!appointment) return null;
            const isCancellation = message.type === 'cancellation';

            return (
              <li key={`failed-${message.id}`}>
                <Link
                  href={`/admin/turnos/${appointment.date_range_id}#appointment-${appointment.id}`}
                  className="block rounded-lg border border-[#E3B3B3] bg-[#FBEAEA] p-5 transition hover:border-[#C77F8F]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="font-semibold text-[#542B32]">
                        {appointment.client_first_name} {appointment.client_last_name}
                      </h2>
                      <p className="mt-1 text-sm text-[#713B45]">
                        {formatLong(appointment.appointment_date)} · {normalizeTime(appointment.appointment_time)}
                      </p>
                      <p className="mt-1 text-xs text-[#8C3B3B]">
                        {rangeTitles.get(appointment.date_range_id) ?? 'Turnos'}
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#8C3B3B]">
                      WhatsApp fallido
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-medium text-[#8C3B3B]">
                    Falló el mensaje de {isCancellation ? 'cancelación' : 'confirmación'} · Reintentar →
                  </p>
                </Link>
              </li>
            );
          })}

          {pendingAppointments.map((appointment) => (
            <li key={appointment.id}>
              <Link
                href={`/admin/turnos/${appointment.date_range_id}#appointment-${appointment.id}`}
                className="block rounded-lg border border-[#E8DED7] bg-white p-5 transition hover:border-[#9B3B54]/40 hover:bg-[#FBF7F3]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-[#2B2320]">
                      {appointment.client_first_name} {appointment.client_last_name}
                    </h2>
                    <p className="mt-1 text-sm text-[#4A423E]">
                      {formatLong(appointment.appointment_date)} · {normalizeTime(appointment.appointment_time)}
                    </p>
                    <p className="mt-1 text-xs text-[#8A7D77]">
                      {rangeTitles.get(appointment.date_range_id) ?? 'Turnos'}
                    </p>
                  </div>
                  <span className="rounded-full bg-[#FBF1DD] px-3 py-1 text-xs font-medium text-[#8A6A16]">
                    Pendiente
                  </span>
                </div>
                <p className="mt-3 text-sm font-medium text-[#8B344B]">Revisar solicitud →</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
