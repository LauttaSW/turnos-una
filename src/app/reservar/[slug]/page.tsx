import { notFound } from 'next/navigation';
import { fontDisplay, fontSans } from '@/lib/fonts';
import {
  eachDayInRange,
  formatLong,
  normalizeTime,
  todayIso,
} from '@/lib/dates';
import { createClient } from '@/lib/supabase/server';
import { BookingForm } from './BookingForm';

// Esta página SIEMPRE tiene que pegarle a Supabase en cada visita: los
// slots ocupados cambian todo el tiempo (reservas, confirmaciones,
// cancelaciones) y mostrar una versión vieja significa dejar que un
// cliente intente reservar un horario que ya no está libre.
//
// En local (`next dev`) esto nunca se nota: el modo dev no pre-renderiza
// ni cachea rutas, así que SIEMPRE pega a la base — el problema solo
// aparece en producción (`next build` / Vercel), que si no se le dice
// lo contrario puede optimizar esta página como estática. Con
// createClient() (que usa cookies()) ya debería alcanzar para que
// Next.js la trate como dinámica, pero lo hacemos explícito para no
// depender de esa inferencia.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ReservarPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: range } = await supabase
    .from('date_ranges')
    .select('id, title, start_date, end_date, is_active')
    .eq('slug', slug.toLowerCase())
    .maybeSingle();

  if (!range) {
    notFound();
  }

  const today = todayIso();
  const closed = !range.is_active || range.end_date < today;

  // Los slots ocupados salen de la vista pública, que no expone el
  // nombre ni el teléfono de quien reservó.
  const { data: takenSlots } = await supabase
    .from('appointment_slots_public')
    .select('appointment_date, appointment_time')
    .eq('date_range_id', range.id);

  const occupiedByDate: Record<string, string[]> = {};
  for (const slot of takenSlots ?? []) {
    const day = slot.appointment_date;
    (occupiedByDate[day] ??= []).push(normalizeTime(slot.appointment_time));
  }

  const days = eachDayInRange(range.start_date, range.end_date);

  return (
    <main className={`${fontSans.className} min-h-screen bg-[#FAF6F1]`}>
      <div className="mx-auto max-w-2xl px-5 py-10 sm:px-8 sm:py-14">
        <header>
          <h1 className={`${fontDisplay.className} text-3xl text-[#2B2320]`}>
            {range.title}
          </h1>
          <p className="mt-2 text-sm text-[#8A7D77]">
            {formatLong(range.start_date)} al {formatLong(range.end_date)}
          </p>
        </header>

        <div className="mt-8">
          {closed ? (
            <div className="rounded-lg border border-[#E2D6CF] bg-white px-6 py-10 text-center">
              <p className={`${fontDisplay.className} text-lg text-[#2B2320]`}>
                Este período ya cerró
              </p>
              <p className="mx-auto mt-2 max-w-sm text-sm text-[#8A7D77]">
                Ya no se pueden reservar turnos para estas fechas. Escribinos o
                esperá el próximo link de turnos.
              </p>
            </div>
          ) : (
            <BookingForm
              dateRangeId={range.id}
              slug={slug}
              days={days}
              occupiedByDate={occupiedByDate}
              today={today}
            />
          )}
        </div>
      </div>
    </main>
  );
}
