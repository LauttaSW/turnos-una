import { fontDisplay } from '@/lib/fonts';
import {
  formatLong,
  formatTimestamp,
  getDateRangeStatus,
  todayIso,
  type DateRangeStatus,
} from '@/lib/dates';
import { createDateRange, listDateRanges } from './actions';
import { CopyLinkButton } from './CopyLinkButton';

const STATUS_BADGE: Record<
  DateRangeStatus,
  { label: string; className: string }
> = {
  // Azul suave: el que está corriendo ahora, se distingue del resto.
  ongoing: {
    label: 'En curso',
    className: 'bg-[#E8EFF7] text-[#37618E]',
  },
  // Verde: ya publicado, arranca más adelante.
  upcoming: {
    label: 'Activo',
    className: 'bg-[#EEF6F0] text-[#3F7A5A]',
  },
  expired: {
    label: 'Expirado',
    className: 'bg-[#EFEAE6] text-[#8A7D77]',
  },
};

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { error, success } = await searchParams;
  const dateRanges = await listDateRanges();

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const today = todayIso();

  const inputClass =
    'mt-1.5 w-full rounded-md border border-[#E2D6CF] bg-white px-3.5 py-2.5 text-sm text-[#2B2320] outline-none transition focus:border-[#9B3B54] focus:ring-2 focus:ring-[#9B3B54]/20';
  const labelClass = 'block text-sm font-medium text-[#2B2320]';

  return (
    <div className="max-w-4xl">
      <h1 className={`${fontDisplay.className} text-3xl text-[#2B2320]`}>
        Calendario de turnos
      </h1>
      <p className="mt-2 text-sm text-[#8A7D77]">
        Creá un rango de fechas y compartí el link para que tus clientas
        reserven.
      </p>

      {/* ---------- Formulario ---------- */}
      <section className="mt-8 rounded-lg border border-[#E8DED7] bg-white p-6">
        <h2 className={`${fontDisplay.className} text-lg text-[#2B2320]`}>
          Nuevo rango
        </h2>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-md border border-[#E3B3B3] bg-[#FBEAEA] px-4 py-3 text-sm text-[#8C3B3B]"
          >
            {error}
          </p>
        )}
        {success && (
          <p
            role="status"
            className="mt-4 rounded-md border border-[#C9DFCE] bg-[#EEF6F0] px-4 py-3 text-sm text-[#3F7A5A]"
          >
            {success}
          </p>
        )}

        <form action={createDateRange} className="mt-5 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="start_date" className={labelClass}>
                Fecha de inicio
              </label>
              <input
                id="start_date"
                name="start_date"
                type="date"
                required
                min={today}
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="end_date" className={labelClass}>
                Fecha de fin
              </label>
              <input
                id="end_date"
                name="end_date"
                type="date"
                required
                min={today}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label htmlFor="title" className={labelClass}>
              Título{' '}
              <span className="font-normal text-[#8A7D77]">(opcional)</span>
            </label>
            <input
              id="title"
              name="title"
              type="text"
              maxLength={80}
              placeholder="Si lo dejás vacío: “Turnos 14/9 a 19/9”"
              className={inputClass}
            />
          </div>

          <button
            type="submit"
            className="rounded-md bg-[#9B3B54] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#7A2E43] focus:outline-none focus:ring-2 focus:ring-[#9B3B54]/40 focus:ring-offset-2"
          >
            Crear rango
          </button>
        </form>
      </section>

      {/* ---------- Listado ---------- */}
      <section className="mt-10">
        <h2 className={`${fontDisplay.className} text-lg text-[#2B2320]`}>
          Rangos creados
        </h2>

        {dateRanges.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-[#E2D6CF] px-6 py-10 text-center text-sm text-[#8A7D77]">
            Todavía no creaste ningún rango de fechas.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {dateRanges.map((range) => {
              const status = getDateRangeStatus(
                range.start_date,
                range.end_date
              );
              const expired = status === 'expired';
              const publicUrl = `${siteUrl}/reservar/${range.slug}`;

              return (
                <li
                  key={range.id}
                  className={`rounded-lg border bg-white p-5 transition ${
                    expired
                      ? 'border-[#EDE6E1] opacity-60'
                      : 'border-[#E8DED7]'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium text-[#2B2320]">
                          {range.title}
                        </h3>
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
                      <p className="mt-1 text-xs text-[#8A7D77]">
                        Creado el {formatTimestamp(range.created_at)}
                      </p>
                      <p className="mt-2 truncate font-mono text-xs text-[#8A7D77]">
                        /reservar/{range.slug}
                      </p>
                    </div>

                    <CopyLinkButton url={publicUrl} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
