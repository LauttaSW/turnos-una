import { createClient } from '@/lib/supabase/server';

/**
 * Cantidad total de turnos en estado 'pending', en todos los
 * date_ranges. Se usa para el badge del menú del admin — no necesita
 * ser realtime, se recalcula en cada navegación dentro de /admin
 * porque el layout es un Server Component que corre en cada request.
 */
export async function getPendingAppointmentsCount(): Promise<number> {
  const supabase = await createClient();

  const { count, error } = await supabase
    .from('appointments')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');

  if (error) {
    console.error('Error al contar turnos pendientes:', error);
    return 0;
  }

  return count ?? 0;
}

/**
 * Cantidad de turnos cancelados (por el admin o por el cliente) en los
 * últimos `windowMinutes` (default 60). Se apoya en cancelled_at, que
 * el trigger sync_status_timestamps completa ante cualquier UPDATE que
 * lleve status a 'cancelled' o 'cancelled_by_client'.
 */
export async function getRecentCancellationsCount(
  windowMinutes = 60
): Promise<number> {
  const supabase = await createClient();

  const since = new Date(Date.now() - windowMinutes * 60_000).toISOString();

  const { count, error } = await supabase
    .from('appointments')
    .select('id', { count: 'exact', head: true })
    .in('status', ['cancelled', 'cancelled_by_client'])
    .gte('cancelled_at', since);

  if (error) {
    console.error('Error al contar cancelaciones recientes:', error);
    return 0;
  }

  return count ?? 0;
}

export async function getFailedWhatsAppMessageCount(): Promise<number> {
  const supabase = await createClient();

  const { count, error } = await supabase
    .from('whatsapp_outbox')
    .select('id', { count: 'exact', head: true })
    .in('type', ['confirmation', 'cancellation'])
    .eq('status', 'failed')
    .is('resolved_at', null);

  if (error) {
    console.error('Error al contar mensajes de WhatsApp fallidos:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return 0;
  }

  return count ?? 0;
}
