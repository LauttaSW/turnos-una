import Link from 'next/link';
import { fontDisplay } from '@/lib/fonts';
import { formatLong, normalizeTime, todayIso } from '@/lib/dates';
import { createClient } from '@/lib/supabase/server';
import type { AppointmentRow } from '@/types/database.types';

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
  const rangeIds = [...new Set([...pendingAppointments, ...upcomingAppointments].map((appointment) => appointment.date_range_id))];
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
        {pendingAppointments.length ? (
          <ul className="space-y-3">{pendingAppointments.map(appointmentCard)}</ul>
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
