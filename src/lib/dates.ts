const TIMEZONE = 'America/Argentina/Buenos_Aires';

/**
 * Fecha de hoy en formato 'YYYY-MM-DD' según la zona horaria del salón.
 *
 * No usamos `new Date().toISOString()` porque eso devuelve la fecha en
 * UTC: después de las 21:00 en Argentina ya es "mañana" en UTC, así que
 * un rango que recién vence hoy aparecería como expirado antes de tiempo.
 */
export function todayIso(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** '2026-09-14' -> '14/9' */
export function formatShort(iso: string): string {
  const [, month, day] = iso.split('-');
  return `${Number(day)}/${Number(month)}`;
}

/** '2026-09-14' -> '14/09/2026' */
export function formatLong(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

/** Timestamp de Postgres -> '14/09/2026 18:30' */
export function formatTimestamp(timestamp: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

/** Título por defecto: "Turnos 14/9 a 19/9" */
export function buildDefaultTitle(startDate: string, endDate: string): string {
  return `Turnos ${formatShort(startDate)} a ${formatShort(endDate)}`;
}

export function isExpired(endDate: string): boolean {
  return endDate < todayIso();
}

export type DateRangeStatus = 'expired' | 'ongoing' | 'upcoming';
/**
 * Estado de un rango respecto del día de hoy:
 * - 'expired'  -> ya terminó (end_date < hoy)
 * - 'ongoing'  -> hoy cae dentro del rango (inclusive en ambos extremos)
 * - 'upcoming' -> todavía no empezó (start_date > hoy)
 */
export function getDateRangeStatus(
  startDate: string,
  endDate: string
): DateRangeStatus {
  const today = todayIso();

  if (endDate < today) return 'expired';
  if (startDate > today) return 'upcoming';
  return 'ongoing';
}

/**
 * Todos los días de un rango, inclusive: ['2026-09-14', '2026-09-15', ...]
 *
 * Itera en UTC a propósito: sumar días sobre una fecha local puede
 * saltear o repetir un día si en el medio hay cambio de horario.
 */
export function eachDayInRange(startDate: string, endDate: string): string[] {
  const days: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00Z`);
  const last = new Date(`${endDate}T00:00:00Z`);

  while (cursor <= last) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return days;
}

/** '2026-09-14' -> { weekday: 'lun', dayMonth: '14/9' } */
export function formatDayLabel(iso: string): {
  weekday: string;
  dayMonth: string;
} {
  const weekday = new Intl.DateTimeFormat('es-AR', {
    timeZone: 'UTC',
    weekday: 'short',
  })
    .format(new Date(`${iso}T12:00:00Z`))
    .replace('.', '');

  return { weekday, dayMonth: formatShort(iso) };
}

/** '14:30:00' (time de Postgres) -> '14:30' */
export function normalizeTime(time: string): string {
  return time.slice(0, 5);
}

/**
 * Ahora mismo, expresado en "hora de pared" de Argentina, como Date.
 * Se arma anclado a 'Z' a propósito (no es un instante UTC real): así
 * es directamente comparable con appointment_date + appointment_time,
 * que también son siempre hora de pared de Argentina, nunca UTC.
 */
function argentinaWallClockNow(): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());

  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? '00';

  return new Date(
    `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}Z`
  );
}

/**
 * true si falta MÁS de 1 día para el turno (o sea, todavía se puede
 * cancelar online). Esto es solo para decidir qué mostrar en la UI —
 * la regla real y definitiva vive en la función de Postgres
 * cancel_appointment_by_token, que es la que de verdad autoriza el
 * cambio de estado.
 */
export function canCancelAppointment(
  appointmentDate: string,
  appointmentTime: string
): boolean {
  const appointmentDateTime = new Date(
    `${appointmentDate}T${normalizeTime(appointmentTime)}:00Z`
  );
  const deadline = new Date(
    argentinaWallClockNow().getTime() + 24 * 60 * 60 * 1000
  );

  return appointmentDateTime > deadline;
}

/** Suma (o resta) días a una fecha 'YYYY-MM-DD', ancla en UTC por el
 *  mismo motivo que eachDayInRange: evita saltos por cambio de horario. */
export function addDaysToIso(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** 'Mañana' en fecha de Argentina, formato 'YYYY-MM-DD'. */
export function tomorrowIso(): string {
  return addDaysToIso(todayIso(), 1);
}
