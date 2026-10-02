'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { sendOrQueueWhatsAppMessage } from '@/lib/whatsapp-outbox';
import { formatLong, normalizeTime } from '@/lib/dates';

type CancelRpcResult = {
  success: boolean;
  message: string;
  appointment_id: string | null;
  date_range_id: string | null;
  client_first_name: string | null;
  client_last_name: string | null;
  client_phone: string | null;
  appointment_date: string | null;
  appointment_time: string | null;
};

function buildCancellationMessage(details: {
  client_first_name: string;
  appointment_date: string;
  appointment_time: string;
}): string {
  return `Hola ${details.client_first_name}, se canceló tu turno del ${formatLong(
    details.appointment_date
  )} a las ${normalizeTime(details.appointment_time)} hs con éxito.`;
}

export async function cancelAppointmentByToken(token: string) {
  const supabase = await createClient();

  // Toda la validación (token válido, estado cancelable, plazo de 1
  // día) vive en esta función de Postgres — acá solo interpretamos el
  // resultado. Ver migration_cancel_token.sql para el porqué de no
  // resolver esto con RLS, y migration_cancellation_whatsapp.sql para
  // por qué ahora devuelve también los datos del cliente.
  const { data, error } = await supabase
    .rpc('cancel_appointment_by_token', { p_token: token })
    .maybeSingle<CancelRpcResult>();

  if (error || !data) {
    console.error('Error al llamar cancel_appointment_by_token:', error);
    redirect(
      `/cancelar/${token}?error=${encodeURIComponent(
        'No pudimos procesar la cancelación. Probá de nuevo.'
      )}`
    );
  }

  if (!data.success) {
    redirect(`/cancelar/${token}?error=${encodeURIComponent(data.message)}`);
  }

  // La cancelación YA está aplicada en este punto. El WhatsApp es best
  // effort: si Evolution falla, sendOrQueueWhatsAppMessage lo encola
  // solo — nunca revertimos la cancelación ni cortamos el flujo por
  // esto. El guard de abajo es solo defensivo: en la rama success=true
  // la función SQL siempre trae estos cuatro campos.
  if (
    data.client_first_name &&
    data.client_phone &&
    data.appointment_date &&
    data.appointment_time
  ) {
    await sendOrQueueWhatsAppMessage({
      appointmentId: data.appointment_id,
      phone: data.client_phone,
      message: buildCancellationMessage({
        client_first_name: data.client_first_name,
        appointment_date: data.appointment_date,
        appointment_time: data.appointment_time,
      }),
      type: 'cancellation',
    });
  }

  // El horario cancelado tiene que volver a verse libre en /reservar,
  // y desaparecer de pendientes en el admin. No sabemos el slug del
  // date_range acá (solo su id), por eso se revalida el patrón
  // dinámico completo en vez de una ruta puntual.
  revalidatePath('/reservar/[slug]', 'page');
  if (data.date_range_id) {
    revalidatePath(`/admin/turnos/${data.date_range_id}`);
  }
  revalidatePath('/admin/turnos');

  redirect(`/cancelar/${token}?success=1`);
}
