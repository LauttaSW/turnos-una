import { createClient } from '@/lib/supabase/server';
import { sendWhatsAppMessage } from '@/lib/whatsapp';
import { normalizeTime, tomorrowIso } from '@/lib/dates';
import type { WhatsappOutboxType } from '@/types/database.types';

const MAX_ATTEMPTS = 5;
// Tope defensivo por corrida: si se llegaran a acumular muchos
// mensajes pendientes, un solo flush no intenta vaciar la cola entera
// de una — evita que un poll del admin quede colgado esperando.
const FLUSH_BATCH_SIZE = 20;

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

async function queueFailedMessage(
  supabase: SupabaseServerClient,
  params: {
    appointmentId: string | null;
    phone: string;
    message: string;
    type: WhatsappOutboxType;
    error: string;
  }
): Promise<void> {
  const { error } = await supabase.from('whatsapp_outbox').insert({
    appointment_id: params.appointmentId,
    phone: params.phone,
    message: params.message,
    type: params.type,
    status: 'pending',
    attempts: 1,
    last_error: params.error,
  });

  if (error) {
    console.error('No se pudo encolar el mensaje de WhatsApp:', error);
  }
}

/**
 * Intenta mandar un mensaje ya mismo; si falla, lo encola en
 * whatsapp_outbox para reintentar después. Nunca lanza: el que llama
 * (ej. confirmAppointment) no tiene que envolver esto en try/catch
 * para no bloquear su propio flujo por un problema de WhatsApp.
 */
export async function sendOrQueueWhatsAppMessage(params: {
  appointmentId: string | null;
  phone: string;
  message: string;
  type: WhatsappOutboxType;
}): Promise<void> {
  const result = await sendWhatsAppMessage(params.phone, params.message);

  if (result.ok) return;

  console.error(
    `[whatsapp] Envío directo falló (turno ${params.appointmentId ?? '—'}), encolando: ${result.error}`
  );

  const supabase = await createClient();
  await queueFailedMessage(supabase, { ...params, error: result.error });
}

/**
 * Reintenta los mensajes 'pending' con menos de MAX_ATTEMPTS intentos,
 * del más viejo al más nuevo. Se llama desde el polling de
 * /admin/notifications (cada ~25s) y también está disponible como
 * endpoint aparte (/admin/whatsapp/retry) para forzar un reintento
 * inmediato al probar en local.
 */
export async function flushWhatsAppOutbox(): Promise<{
  processed: number;
  sent: number;
  failed: number;
}> {
  const supabase = await createClient();

  const { data: pendingMessages, error } = await supabase
    .from('whatsapp_outbox')
    .select('*')
    .eq('status', 'pending')
    .lt('attempts', MAX_ATTEMPTS)
    .order('created_at', { ascending: true })
    .limit(FLUSH_BATCH_SIZE);

  if (error) {
    console.error('Error al leer whatsapp_outbox:', error);
    return { processed: 0, sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  // Secuencial a propósito: si Evolution está lenta o recién está
  // volviendo, mandarle 20 requests en paralelo es contraproducente.
  for (const row of pendingMessages ?? []) {
    const result = await sendWhatsAppMessage(row.phone, row.message);
    const newAttempts = row.attempts + 1;

    if (result.ok) {
      await supabase
        .from('whatsapp_outbox')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          attempts: newAttempts,
          last_error: null,
        })
        .eq('id', row.id);
      sent++;
    } else {
      await supabase
        .from('whatsapp_outbox')
        .update({
          attempts: newAttempts,
          last_error: result.error,
          // Al quinto intento fallido dejamos de reintentar solo, pero
          // la fila queda para que se pueda revisar manualmente.
          status: newAttempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
        })
        .eq('id', row.id);
      failed++;
    }
  }

  return { processed: (pendingMessages ?? []).length, sent, failed };
}

type ReminderAppointment = {
  id: string;
  client_first_name: string;
  client_phone: string;
  appointment_time: string;
};

function buildReminderMessage(appt: ReminderAppointment): string {
  return `Hola ${appt.client_first_name}, recordá que mañana a las ${normalizeTime(
    appt.appointment_time
  )} hs es tu turno.`;
}

/**
 * Busca turnos 'confirmed' para mañana (hora Argentina) que todavía no
 * tienen reminder_sent_at, y les manda el recordatorio.
 *
 * Ojo con la idempotencia: reminder_sent_at se marca ANTES de intentar
 * el envío, no después. Si dependiera de un envío exitoso, un
 * Evolution caído haría que esta función re-encuentre el mismo turno
 * en cada corrida (cada poll, si se llama automáticamente) y encolara
 * un recordatorio duplicado por cada ciclo. Al marcarlo primero, cada
 * turno se "reclama" una sola vez, y el reintento del envío en sí
 * queda a cargo de flushWhatsAppOutbox.
 *
 * El UPDATE de reclamo lleva `is('reminder_sent_at', null)`: si dos
 * pestañas del admin dispararan esto casi en simultáneo, solo una va
 * a lograr el update (la otra encuentra la fila ya no-null y no hace
 * nada), evitando el recordatorio duplicado.
 */
export async function sendDueReminders(): Promise<{
  sent: number;
  failed: number;
}> {
  const supabase = await createClient();
  const targetDate = tomorrowIso();

  const { data: dueAppointments, error } = await supabase
    .from('appointments')
    .select('id, client_first_name, client_phone, appointment_time')
    .eq('status', 'confirmed')
    .eq('appointment_date', targetDate)
    .is('reminder_sent_at', null);

  if (error) {
    console.error('Error al buscar turnos para recordatorio:', error);
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  for (const appt of dueAppointments ?? []) {
    const { data: claimed } = await supabase
      .from('appointments')
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq('id', appt.id)
      .is('reminder_sent_at', null)
      .select('id')
      .maybeSingle();

    if (!claimed) continue; // otra corrida ya se lo adjudicó

    const message = buildReminderMessage(appt);
    const result = await sendWhatsAppMessage(appt.client_phone, message);

    if (result.ok) {
      sent++;
    } else {
      await queueFailedMessage(supabase, {
        appointmentId: appt.id,
        phone: appt.client_phone,
        message,
        type: 'reminder',
        error: result.error,
      });
      failed++;
    }
  }

  return { sent, failed };
}
