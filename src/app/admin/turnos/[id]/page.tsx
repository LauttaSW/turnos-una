import Link from 'next/link';
import { notFound } from 'next/navigation';
import { fontDisplay } from '@/lib/fonts';
import { formatLong, normalizeTime } from '@/lib/dates';
import { createClient } from '@/lib/supabase/server';
import type { AppointmentRow, AppointmentStatus } from '@/types/database.types';
import {
  cancelAppointment,
  confirmAppointment,
  markCompleted,
  markInProgress,
  updateAppointmentClient,
} from './actions';

const STATUS_BADGE: Record<
  AppointmentStatus,
  { label: string; className: string }
> = {
  pending: { label: 'Pendiente', className: 'bg-[#FBF1DD] text-[#8A6A16]' },
  confirmed: { label: 'Confirmado', className: 'bg-[#EEF6F0] text-[#3F7A5A]' },
  in_progress: { label: 'En curso', className: 'bg-[#E8EFF7] text-[#37618E]' },
  completed: { label: 'Ya atendido', className: 'bg-[#EDEEF0] text-[#5B6169]' },
  cancelled_by_client: {
    label: 'Cancelado por el cliente',
    className: 'bg-[#EFE7F0] text-[#6B4C74]',
  },
  cancelled: { label: 'Cancelado', className: 'bg-[#EFEAE6] text-[#8A7D77]' },
};

// Orden de la lista: pending -> confirmed -> in_progress -> completed
// -> cancelled_by_client -> cancelled (siempre al final). Explícito
// acá en vez de confiar en el orden interno del enum de Postgres, para
// que quede claro de un vistazo leyendo el componente.
const STATUS_ORDER: Record<AppointmentStatus, number> = {
  pending: 0,
  confirmed: 1,
  in_progress: 2,
  completed: 3,
  cancelled_by_client: 4,
  cancelled: 5,
};

function sortAppointments(appointments: AppointmentRow[]): AppointmentRow[] {
  return [...appointments].sort((a, b) => {
    const statusDiff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (statusDiff !== 0) return statusDiff;

    if (a.appointment_date !== b.appointment_date) {
      return a.appointment_date < b.appointment_date ? -1 : 1;
    }

    return a.appointment_time < b.appointment_time ? -1 : 1;
  });
}

export default async function TurnosDelRangoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { id } = await params;
  const { error, success } = await searchParams;

  const supabase = await createClient();

  const { data: range } = await supabase
    .from('date_ranges')
    .select('id, title, start_date, end_date')
    .eq('id', id)
    .maybeSingle();

  if (!range) {
    notFound();
  }

  const { data: appointmentsData } = await supabase
    .from('appointments')
    .select('*')
    .eq('date_range_id', id)
    .order('appointment_date', { ascending: true })
    .order('appointment_time', { ascending: true });

  const appointments = sortAppointments(appointmentsData ?? []);

  return (
    <div className="max-w-4xl">
      <Link
        href="/admin/turnos"
        className="text-sm text-[#8A7D77] transition hover:text-[#7A2E43]"
      >
        ← Volver a turnos
      </Link>

      <h1 className={`${fontDisplay.className} mt-2 text-3xl text-[#2B2320]`}>
        {range.title}
      </h1>
      <p className="mt-1 text-sm text-[#8A7D77]">
        {formatLong(range.start_date)} — {formatLong(range.end_date)}
      </p>

      {error && (
        <p
          role="alert"
          className="mt-6 rounded-md border border-[#E3B3B3] bg-[#FBEAEA] px-4 py-3 text-sm text-[#8C3B3B]"
        >
          {error}
        </p>
      )}
      {success && (
        <p
          role="status"
          className="mt-6 rounded-md border border-[#C9DFCE] bg-[#EEF6F0] px-4 py-3 text-sm text-[#3F7A5A]"
        >
          {success}
        </p>
      )}

      {appointments.length === 0 ? (
        <p className="mt-8 rounded-lg border border-dashed border-[#E2D6CF] px-6 py-10 text-center text-sm text-[#8A7D77]">
          Todavía no hay solicitudes de turno para este período.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {appointments.map((appt) => {
            const canCancel =
              appt.status === 'pending' ||
              appt.status === 'confirmed' ||
              appt.status === 'in_progress';

            return (
              <li
                key={appt.id}
                className="rounded-lg border border-[#E8DED7] bg-white p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-medium text-[#2B2320]">
                        {appt.client_first_name} {appt.client_last_name}
                      </h2>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[appt.status].className}`}
                      >
                        {STATUS_BADGE[appt.status].label}
                      </span>
                    </div>

                    <p className="mt-1 text-sm text-[#4A423E]">
                      {formatLong(appt.appointment_date)} ·{' '}
                      {normalizeTime(appt.appointment_time)} hs
                    </p>
                    <p className="mt-1 text-sm text-[#8A7D77]">
                      {appt.client_phone}
                    </p>
                    {appt.notes && (
                      <p className="mt-2 text-sm italic text-[#8A7D77]">
                        “{appt.notes}”
                      </p>
                    )}
                    <details className="mt-3">
                      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-[#7A2E43] transition hover:bg-[#F3E4E8] focus:outline-none focus:ring-2 focus:ring-[#9B3B54]/30 [&::-webkit-details-marker]:hidden">
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 20 20"
                          fill="none"
                          className="h-3.5 w-3.5"
                        >
                          <path
                            d="m13.8 3.2 3 3M4 16l.7-3.3L13.8 3.6a1.4 1.4 0 0 1 2 0l.6.6a1.4 1.4 0 0 1 0 2L7.3 15.3 4 16Z"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        Editar datos
                      </summary>
                      <form
                        action={updateAppointmentClient.bind(null, range.id, appt.id)}
                        className="mt-3 grid gap-3 rounded-md border border-[#EDE6E1] bg-[#FAF6F1] p-3 sm:grid-cols-3"
                      >
                        <label className="text-xs font-medium text-[#8A7D77]">
                          Nombre
                          <input
                            name="client_first_name"
                            type="text"
                            required
                            maxLength={80}
                            defaultValue={appt.client_first_name}
                            className="mt-1 block w-full rounded-md border border-[#E2D6CF] bg-white px-3 py-2 text-sm font-normal text-[#2B2320] focus:border-[#9B3B54] focus:outline-none"
                          />
                        </label>
                        <label className="text-xs font-medium text-[#8A7D77]">
                          Apellido
                          <input
                            name="client_last_name"
                            type="text"
                            required
                            maxLength={80}
                            defaultValue={appt.client_last_name}
                            className="mt-1 block w-full rounded-md border border-[#E2D6CF] bg-white px-3 py-2 text-sm font-normal text-[#2B2320] focus:border-[#9B3B54] focus:outline-none"
                          />
                        </label>
                        <label className="text-xs font-medium text-[#8A7D77]">
                          Teléfono
                          <input
                            name="client_phone"
                            type="tel"
                            required
                            maxLength={24}
                            defaultValue={appt.client_phone}
                            className="mt-1 block w-full rounded-md border border-[#E2D6CF] bg-white px-3 py-2 text-sm font-normal text-[#2B2320] focus:border-[#9B3B54] focus:outline-none"
                          />
                        </label>
                        <div className="sm:col-span-3">
                          <button
                            type="submit"
                            className="rounded-md border border-[#E2D6CF] bg-white px-3 py-1.5 text-xs font-medium text-[#7A2E43] transition hover:border-[#9B3B54]/50 hover:bg-[#F3E4E8]"
                          >
                            Guardar cambios
                          </button>
                        </div>
                      </form>
                    </details>
                  </div>

                  {canCancel && (
                    <div className="flex shrink-0 flex-wrap justify-end gap-2">
                      {appt.status === 'pending' && (
                        <form
                          action={confirmAppointment.bind(
                            null,
                            range.id,
                            appt.id
                          )}
                        >
                          <button
                            type="submit"
                            className="rounded-md bg-[#3F7A5A] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#336249]"
                          >
                            Confirmar
                          </button>
                        </form>
                      )}

                      {appt.status === 'confirmed' && (
                        <form
                          action={markInProgress.bind(
                            null,
                            range.id,
                            appt.id
                          )}
                        >
                          <button
                            type="submit"
                            className="rounded-md bg-[#37618E] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#2C4E73]"
                          >
                            Marcar en curso
                          </button>
                        </form>
                      )}

                      {appt.status === 'in_progress' && (
                        <form
                          action={markCompleted.bind(
                            null,
                            range.id,
                            appt.id
                          )}
                        >
                          <button
                            type="submit"
                            className="rounded-md bg-[#9B3B54] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#7A2E43]"
                          >
                            Marcar ya atendido
                          </button>
                        </form>
                      )}

                      <form
                        action={cancelAppointment.bind(null, range.id, appt.id)}
                      >
                        <button
                          type="submit"
                          className="rounded-md border border-[#E3B3B3] px-3 py-1.5 text-xs font-medium text-[#8C3B3B] transition hover:bg-[#FBEAEA]"
                        >
                          Cancelar
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
