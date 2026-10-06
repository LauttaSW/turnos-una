'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { formatDayLabel, formatLong } from '@/lib/dates';
import { AVAILABLE_TIME_SLOTS } from '@/types/database.types';
import { createAppointment, type BookingState } from './actions';

type Props = {
  dateRangeId: string;
  slug: string;
  days: string[];
  /** fecha (YYYY-MM-DD) -> horarios ocupados en formato 'HH:mm' */
  occupiedByDate: Record<string, string[]>;
  today: string;
};

const initialState: BookingState = { status: 'idle' };

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-12 w-full rounded-xl bg-[#9B3B54] px-5 py-3 text-base font-semibold text-white transition hover:bg-[#7A2E43] focus:outline-none focus:ring-2 focus:ring-[#9B3B54]/40 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
    >
      {pending ? 'Enviando…' : 'Solicitar turno'}
    </button>
  );
}

export function BookingForm({
  dateRangeId,
  slug,
  days,
  occupiedByDate,
  today,
}: Props) {
  const bookableDays = days.filter((day) => day >= today);

  const [selectedDay, setSelectedDay] = useState<string | null>(
    bookableDays[0] ?? null
  );
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [successDismissed, setSuccessDismissed] = useState(false);
  const [state, formAction] = useActionState(createAppointment, initialState);
  const showSuccess = state.status === 'success' && !successDismissed;
  const submitAction = (formData: FormData) => {
    setSuccessDismissed(false);
    formAction(formData);
  };

  const occupied = selectedDay ? (occupiedByDate[selectedDay] ?? []) : [];

  if (bookableDays.length === 0) {
    return (
      <p className="rounded-lg border border-[#E2D6CF] bg-white px-5 py-6 text-center text-sm text-[#8A7D77]">
        Ya no quedan días disponibles en este período.
      </p>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-8">
      {/* -------- Paso 1: día -------- */}
      <section className="rounded-2xl border border-[#E8DED7] bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-base font-semibold text-[#2B2320]">
          <span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#F3E4E8] text-sm text-[#7A2E43]">1</span>
          Elegí el día
        </h2>

        <div className="-mx-1 mt-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]">
          {bookableDays.map((day) => {
            const { weekday, dayMonth } = formatDayLabel(day);
            const active = day === selectedDay;

            return (
              <button
                key={day}
                type="button"
                onClick={() => {
                  if (state.status === 'success') setSuccessDismissed(true);
                  setSelectedDay(day);
                  setSelectedTime(null);
                }}
                aria-pressed={active}
                className={`flex min-h-[4.25rem] min-w-[76px] shrink-0 snap-start flex-col items-center justify-center rounded-xl border px-3 py-2.5 transition ${
                  active
                    ? 'border-[#9B3B54] bg-[#9B3B54] text-white'
                    : 'border-[#E2D6CF] bg-white text-[#4A423E] hover:border-[#9B3B54]/50'
                }`}
              >
                <span className="text-xs capitalize opacity-80">{weekday}</span>
                <span className="text-base font-semibold">{dayMonth}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* -------- Paso 2: horario -------- */}
      <section className="rounded-2xl border border-[#E8DED7] bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-base font-semibold text-[#2B2320]">
          <span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#F3E4E8] text-sm text-[#7A2E43]">2</span>
          Elegí el horario
        </h2>

        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {AVAILABLE_TIME_SLOTS.map((time) => {
            const isTaken = occupied.includes(time);
            const active = time === selectedTime;

            return (
              <button
                key={time}
                type="button"
                disabled={isTaken}
                onClick={() => {
                  if (state.status === 'success') setSuccessDismissed(true);
                  setSelectedTime(time);
                }}
                aria-pressed={active}
                className={`min-h-12 rounded-xl border px-2 py-2.5 text-sm font-medium transition ${
                  isTaken
                    ? 'cursor-not-allowed border-[#EDE6E1] bg-[#F2EEEA] text-[#B9ADA6] line-through'
                    : active
                      ? 'border-[#9B3B54] bg-[#9B3B54] font-medium text-white'
                      : 'border-[#E2D6CF] bg-white text-[#4A423E] hover:border-[#9B3B54]/50 hover:bg-[#F3E4E8]'
                }`}
              >
                {time}
              </button>
            );
          })}
        </div>

        <p className="mt-3 text-xs text-[#8A7D77]">
          Los horarios tachados ya están reservados.
        </p>
      </section>

      {/* -------- Paso 3: datos -------- */}
      {selectedDay && selectedTime && !showSuccess && (
        <section className="rounded-2xl border border-[#E8DED7] bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-base font-semibold text-[#2B2320]">
            <span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#F3E4E8] text-sm text-[#7A2E43]">3</span>
            Tus datos
          </h2>

          <p className="mt-4 rounded-xl bg-[#F3E4E8] px-4 py-3 text-sm font-medium text-[#7A2E43]">
            Turno para el {formatLong(selectedDay)} a las {selectedTime} hs
          </p>

          <form action={submitAction} className="mt-4 space-y-4">
            <input type="hidden" name="date_range_id" value={dateRangeId} />
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="appointment_date" value={selectedDay} />
            <input type="hidden" name="appointment_time" value={selectedTime} />

            <div className="grid gap-4">
              <div>
                <label
                  htmlFor="client_first_name"
                  className="block text-sm font-medium text-[#2B2320]"
                >
                  Nombre
                </label>
                <input
                  id="client_first_name"
                  name="client_first_name"
                  type="text"
                  required
                  maxLength={60}
                  autoComplete="given-name"
                  className="mt-1.5 min-h-12 w-full rounded-xl border border-[#E2D6CF] bg-white px-3.5 py-3 text-base text-[#2B2320] outline-none transition focus:border-[#9B3B54] focus:ring-2 focus:ring-[#9B3B54]/20 sm:text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="client_last_name"
                  className="block text-sm font-medium text-[#2B2320]"
                >
                  Apellido
                </label>
                <input
                  id="client_last_name"
                  name="client_last_name"
                  type="text"
                  required
                  maxLength={60}
                  autoComplete="family-name"
                  className="mt-1.5 min-h-12 w-full rounded-xl border border-[#E2D6CF] bg-white px-3.5 py-3 text-base text-[#2B2320] outline-none transition focus:border-[#9B3B54] focus:ring-2 focus:ring-[#9B3B54]/20 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="client_phone"
                className="block text-sm font-medium text-[#2B2320]"
              >
                Celular
              </label>
              <input
                id="client_phone"
                name="client_phone"
                type="tel"
                required
                inputMode="tel"
                placeholder="+54 9 2346 123456"
                autoComplete="tel"
                className="mt-1.5 min-h-12 w-full rounded-xl border border-[#E2D6CF] bg-white px-3.5 py-3 text-base text-[#2B2320] outline-none transition focus:border-[#9B3B54] focus:ring-2 focus:ring-[#9B3B54]/20 sm:text-sm"
              />
              <p className="mt-1 text-xs text-[#8A7D77]">
                Te vamos a confirmar el turno por WhatsApp.
              </p>
            </div>

            <div>
              <label
                htmlFor="notes"
                className="block text-sm font-medium text-[#2B2320]"
              >
                Comentario{' '}
                <span className="font-normal text-[#8A7D77]">(opcional)</span>
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={2}
                maxLength={300}
                className="mt-1.5 min-h-24 w-full rounded-xl border border-[#E2D6CF] bg-white px-3.5 py-3 text-base text-[#2B2320] outline-none transition focus:border-[#9B3B54] focus:ring-2 focus:ring-[#9B3B54]/20 sm:text-sm"
              />
            </div>

            <SubmitButton />
          </form>
        </section>
      )}

      {/* -------- Resultado -------- */}
      {state.status === 'error' && (
        <p
          role="alert"
          className="rounded-md border border-[#E3B3B3] bg-[#FBEAEA] px-4 py-3 text-sm text-[#8C3B3B]"
        >
          {state.message}
        </p>
      )}
      {showSuccess && (
        <p
          role="status"
          className="rounded-md border border-[#C9DFCE] bg-[#EEF6F0] px-4 py-3 text-sm text-[#3F7A5A]"
        >
          {state.message}
        </p>
      )}
    </div>
  );
}
