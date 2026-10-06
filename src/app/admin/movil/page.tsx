import Link from 'next/link';
import { fontDisplay } from '@/lib/fonts';
import { formatLong, normalizeTime, todayIso } from '@/lib/dates';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import type {
  AppointmentRow,
  WhatsappOutboxRow,
} from '@/types/database.types';

const ACTIVE_STATUSES = ['pending', 'confirmed', 'in_progress'] as const;

const STATUS_LABEL: Record<(typeof ACTIVE_STATUSES)[number], string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmado',
  in_progress: 'En curso',
};

export default async function AdminMobileHomePage() {
  const supabase = await createClient();
  const today = todayIso();
  const [{ data: pendingData }, { data: upcomingData }] = await Promise.all([
    supabase
      .from('appointments')
      .select('*')
      .eq('status', 'pending')
      .order('appointment_date', { ascending: true })
      .order('appointment_time', { ascending: true })
      .limit(20),
    supabase
      .from('appointments')
      .select('*')
      .in('status', [...ACTIVE_STATUSES])
      .gte('appointment_date', today)
      .order('appointment_date', { ascending: true })
      .order('appointment_time', { ascending: true })
      .limit(20),
  ]);

  const pendingAppointments: AppointmentRow[] = pendingData ?? [];
  const upcomingAppointments: AppointmentRow[] = upcomingData ?? [];

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
      .limit(20);

    if (error) {
      failedMessageLookupUnavailable = true;
      console.warn('No se pudieron consultar los mensajes fallidos:', error.message);
    } else {
      failedMessages = data ?? [];
    }
  } catch (error) {
    failedMessageLookupUnavailable = true;
    console.warn(
      'No se pudo consultar la cola de WhatsApp:',
      error instanceof Error ? error.message : error
    );
  }

  const failedAppointmentIds = [...new Set(
    failedMessages
      .map((message) => message.appointment_id)
      .filter((id): id is string => Boolean(id))
  )];
  const { data: failedAppointmentsData } = failedAppointmentIds.length
    ? await supabase.from('appointments').select('*').in('id', failedAppointmentIds)
    : { data: [] };
  const failedAppointments = new Map(
    (failedAppointmentsData ?? []).map((appointment) => [appointment.id, appointment as AppointmentRow])
  );
  const retryableFailedMessages = failedMessages.filter((message) => {
    if (!message.appointment_id) return false;
    const appointment = failedAppointments.get(message.appointment_id);
    if (!appointment) return false;
    if (message.type === 'confirmation') {
      return ['confirmed', 'in_progress', 'completed'].includes(appointment.status);
    }
    if (message.type === 'cancellation') {
      return ['cancelled', 'cancelled_by_client'].includes(appointment.status);
    }
    return false;
  });

  const rangeIds = [...new Set([
    ...pendingAppointments,
    ...upcomingAppointments,
    ...(failedAppointmentsData ?? []),
  ].map((appointment) => appointment.date_range_id))];
  const { data: ranges } = rangeIds.length
    ? await supabase.from('date_ranges').select('id, title').in('id', rangeIds)
    : { data: [] };
  const titleByRangeId = new Map((ranges ?? []).map((range) => [range.id, range.title]));

  function appointmentCard(appointment: AppointmentRow) {
    const rangeTitle = titleByRangeId.get(appointment.date_range_id) ?? 'Turnos';
    return (
      <li key={appointment.id}>
        <Link href={`/admin/turnos/${appointment.date_range_id}`} className="block rounded-2xl border border-[#E8DED7] bg-white p-4 shadow-sm transition active:scale-[0.99] hover:border-[#9B3B54]/40">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-semibold text-[#2B2320]">{appointment.client_first_name} {appointment.client_last_name}</p>
              <p className="mt-1 text-sm text-[#4A423E]">{formatLong(appointment.appointment_date)} · {normalizeTime(appointment.appointment_time)}</p>
              <p className="mt-1 truncate text-xs text-[#8A7D77]">{rangeTitle}</p>
            </div>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${appointment.status === 'pending' ? 'bg-[#FBF1DD] text-[#8A6A16]' : appointment.status === 'confirmed' ? 'bg-[#EEF6F0] text-[#3F7A5A]' : 'bg-[#E8EFF7] text-[#37618E]'}`}>
              {STATUS_LABEL[appointment.status as (typeof ACTIVE_STATUSES)[number]]}
            </span>
          </div>
          {appointment.status === 'pending' && <p className="mt-3 text-sm font-medium text-[#8B344B]">Revisar solicitud →</p>}
        </Link>
      </li>
    );
  }

  function failedMessageCard(message: WhatsappOutboxRow) {
    if (!message.appointment_id) return null;
    const appointment = failedAppointments.get(message.appointment_id);
    if (!appointment) return null;
    const isCancellation = message.type === 'cancellation';
    const rangeTitle = titleByRangeId.get(appointment.date_range_id) ?? 'Turnos';

    return (
      <li key={`failed-${message.id}`}>
        <Link
          href={`/admin/turnos/${appointment.date_range_id}#appointment-${appointment.id}`}
          className="block rounded-2xl border border-[#E3B3B3] bg-[#FBEAEA] p-4 shadow-sm transition active:scale-[0.99] hover:border-[#C77F8F]"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-semibold text-[#542B32]">
                {appointment.client_first_name} {appointment.client_last_name}
              </p>
              <p className="mt-1 text-sm text-[#713B45]">
                {formatLong(appointment.appointment_date)} · {normalizeTime(appointment.appointment_time)}
              </p>
              <p className="mt-1 truncate text-xs text-[#8C3B3B]">{rangeTitle}</p>
            </div>
            <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#8C3B3B]">
              WhatsApp fallido
            </span>
          </div>
          <p className="mt-3 text-sm font-medium text-[#8C3B3B]">
            Falló el mensaje de {isCancellation ? 'cancelación' : 'confirmación'} · Reintentar →
          </p>
        </Link>
      </li>
    );
  }

  return (
    <div className="space-y-7">
      <section>
        <p className="text-sm font-medium text-[#8A7D77]">Panel de administración</p>
        <h1 className={`${fontDisplay.className} mt-1 text-3xl text-[#2B2320]`}>Hola, Belén</h1>
        <p className="mt-2 text-sm text-[#6E625C]">Gestioná los turnos desde tu celular.</p>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className={`${fontDisplay.className} text-xl text-[#2B2320]`}>Solicitudes por revisar</h2>
            <p className="mt-1 text-xs text-[#8A7D77]">Turnos pendientes de aprobación</p>
          </div>
          <Link href="/admin/turnos" className="min-h-11 shrink-0 rounded-xl px-3 py-2 text-sm font-medium text-[#8B344B] hover:bg-[#F3E4E8]">Ver todas</Link>
        </div>
        {failedMessageLookupUnavailable && (
          <p className="mb-3 rounded-xl border border-[#E7D7A8] bg-[#FFF8E5] px-4 py-3 text-sm text-[#765D1B]">
            No se pudieron consultar los avisos de WhatsApp. Revisá la clave secreta de Supabase en el servidor.
          </p>
        )}
        {retryableFailedMessages.length > 0 || pendingAppointments.length > 0 ? (
          <ul className="space-y-3">
            {retryableFailedMessages.map(failedMessageCard)}
            {pendingAppointments.map(appointmentCard)}
          </ul>
        ) : (
          <p className="rounded-2xl border border-dashed border-[#E2D6CF] bg-white/60 px-4 py-6 text-center text-sm text-[#8A7D77]">No hay solicitudes pendientes.</p>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className={`${fontDisplay.className} text-xl text-[#2B2320]`}>Próximos turnos</h2>
            <p className="mt-1 text-xs text-[#8A7D77]">Desde hoy</p>
          </div>
          <Link href="/admin/calendario" className="min-h-11 shrink-0 rounded-xl px-3 py-2 text-sm font-medium text-[#8B344B] hover:bg-[#F3E4E8]">Calendario</Link>
        </div>
        {upcomingAppointments.length ? (
          <ul className="space-y-3">{upcomingAppointments.map(appointmentCard)}</ul>
        ) : (
          <p className="rounded-2xl border border-dashed border-[#E2D6CF] bg-white/60 px-4 py-6 text-center text-sm text-[#8A7D77]">No hay próximos turnos.</p>
        )}
      </section>
    </div>
  );
}
