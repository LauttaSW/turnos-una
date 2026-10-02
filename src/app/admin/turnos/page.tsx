import Link from 'next/link';
import { fontDisplay } from '@/lib/fonts';
import {
  formatLong,
  getDateRangeStatus,
  type DateRangeStatus,
} from '@/lib/dates';
import { createClient } from '@/lib/supabase/server';
import type { DateRangeRow } from '@/types/database.types';

const STATUS_BADGE: Record<
  DateRangeStatus,
  { label: string; className: string }
> = {
  ongoing: { label: 'En curso', className: 'bg-[#E8EFF7] text-[#37618E]' },
  upcoming: { label: 'Próximo', className: 'bg-[#EEF6F0] text-[#3F7A5A]' },
  expired: { label: 'Expirado', className: 'bg-[#EFEAE6] text-[#8A7D77]' },
};

export default async function TurnosPage() {
  const supabase = await createClient();

  const [{ data: dateRangesData }, { data: appointmentsData }] =
    await Promise.all([
      supabase
        .from('date_ranges')
        .select('*')
        .order('created_at', { ascending: false }),
      // Traemos todo de una sola vez y contamos en memoria en vez de
      // hacer una query de conteo por cada rango (evita N+1 queries).
      supabase.from('appointments').select('date_range_id, status'),
    ]);

  const dateRanges: DateRangeRow[] = dateRangesData ?? [];

  const pendingCountByRange = new Map<string, number>();
  for (const appt of appointmentsData ?? []) {
    if (appt.status === 'pending') {
      pendingCountByRange.set(
        appt.date_range_id,
        (pendingCountByRange.get(appt.date_range_id) ?? 0) + 1
      );
    }
  }

  return (
    <div className="max-w-4xl">
      <h1 className={`${fontDisplay.className} text-3xl text-[#2B2320]`}>
        Turnos
      </h1>
      <p className="mt-2 text-sm text-[#8A7D77]">
        Elegí un período para ver y gestionar sus solicitudes.
      </p>

      {dateRanges.length === 0 ? (
        <p className="mt-8 rounded-lg border border-dashed border-[#E2D6CF] px-6 py-10 text-center text-sm text-[#8A7D77]">
          Todavía no creaste ningún rango de fechas.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {dateRanges.map((range) => {
            const status = getDateRangeStatus(
              range.start_date,
              range.end_date
            );
            const pending = pendingCountByRange.get(range.id) ?? 0;

            return (
              <li key={range.id}>
                <Link
                  href={`/admin/turnos/${range.id}`}
                  className="block rounded-lg border border-[#E8DED7] bg-white p-5 transition hover:border-[#9B3B54]/40 hover:bg-[#FBF7F3]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-medium text-[#2B2320]">
                          {range.title}
                        </h2>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[status].className}`}
                        >
                          {STATUS_BADGE[status].label}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-[#4A423E]">
                        {formatLong(range.start_date)} —{' '}
                        {formatLong(range.end_date)}
                      </p>
                    </div>

                    {pending > 0 && (
                      <span className="shrink-0 rounded-full bg-[#9B3B54] px-2.5 py-1 text-xs font-medium text-white">
                        {pending} pendiente{pending === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
