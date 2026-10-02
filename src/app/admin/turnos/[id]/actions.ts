'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { sendOrQueueWhatsAppMessage } from '@/lib/whatsapp-outbox';
import { formatLong, normalizeTime } from '@/lib/dates';
import type { AppointmentRow, AppointmentStatus } from '@/types/database.types';

type ConfirmationDetails = Pick<
  AppointmentRow,
  | 'client_first_name'
  | 'client_last_name'
  | 'client_phone'
  | 'appointment_date'
  | 'appointment_time'
  | 'cancel_token'
>;

function buildConfirmationMessage(appt: ConfirmationDetails): string {
  const lines = [
    `Hola ${appt.client_first_name} ${appt.client_last_name}, se confirmó tu turno para el ${formatLong(
      appt.appointment_date
    )} a las ${normalizeTime(appt.appointment_time)} hs.`,
  ];

  // cancel_token lo genera el trigger de la DB al confirmar, así que
  // en el flujo normal siempre va a venir seteado acá. El guard es
  // solo por si esta acción corre antes de aplicar la migración
  // correspondiente: en ese caso, mandamos igual la confirmación,
  // sin el link roto.
  if (appt.cancel_token) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
    lines.push(
      '',
      'Si necesitás cancelar, podés hacerlo hasta 1 día antes desde este link:',
      `${siteUrl}/cancelar/${appt.cancel_token}`
    );
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------
// Confirmar: la única acción que además dispara el WhatsApp, ahora vía
// la cola confiable (sendOrQueueWhatsAppMessage) en vez del envío
// directo de antes.
// ---------------------------------------------------------------------
export async function confirmAppointment(rangeId: string, appointmentId: string) {
  const supabase = await createClient();

  // update + select en la misma llamada: evita un round-trip extra
  // solo para volver a leer los datos del cliente y armar el mensaje.
  // cancel_token ya viene generado acá mismo: el trigger set_cancel_token
  // corre "before update of status" y lo completa antes de que este
  // select devuelva la fila.
  const { data: appt, error } = await supabase
    .from('appointments')
    .update({ status: 'confirmed' })
    .eq('id', appointmentId)
    .select(
      'client_first_name, client_last_name, client_phone, appointment_date, appointment_time, cancel_token'
    )
    .single<ConfirmationDetails>();

  if (error || !appt) {
    console.error('Error al confirmar appointment:', error);
    redirect(
      `/admin/turnos/${rangeId}?error=${encodeURIComponent(
        'No se pudo confirmar el turno. Probá de nuevo.'
      )}`
    );
  }

  // El turno YA está confirmado en este punto. Lo que sigue es best
  // effort: si Evolution API falla, sendOrQueueWhatsAppMessage lo deja
  // en whatsapp_outbox para reintentar solo — nunca revertimos ni
  // cortamos el flujo por esto.
  await sendOrQueueWhatsAppMessage({
    appointmentId,
    phone: appt.client_phone,
    message: buildConfirmationMessage(appt),
    type: 'confirmation',
  });

  revalidatePath(`/admin/turnos/${rangeId}`);
  revalidatePath('/admin/turnos');

  redirect(
    `/admin/turnos/${rangeId}?success=${encodeURIComponent('Turno confirmado.')}`
  );
}

// ---------------------------------------------------------------------
// Cancelar / en curso / atendido: mismo patrón simple (solo cambian
// status), así que comparten esta única implementación.
// ---------------------------------------------------------------------
type SimpleStatus = Exclude<AppointmentStatus, 'pending' | 'confirmed'>;

async function setSimpleStatus(
  rangeId: string,
  appointmentId: string,
  newStatus: SimpleStatus,
  successMessage: string
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from('appointments')
    .update({ status: newStatus })
    .eq('id', appointmentId);

  if (error) {
    console.error(`Error al pasar el turno a "${newStatus}":`, error);
    redirect(
      `/admin/turnos/${rangeId}?error=${encodeURIComponent(
        'No se pudo actualizar el turno. Probá de nuevo.'
      )}`
    );
  }

  revalidatePath(`/admin/turnos/${rangeId}`);
  revalidatePath('/admin/turnos');

  redirect(
    `/admin/turnos/${rangeId}?success=${encodeURIComponent(successMessage)}`
  );
}

export async function cancelAppointment(rangeId: string, appointmentId: string) {
  await setSimpleStatus(rangeId, appointmentId, 'cancelled', 'Turno cancelado.');
}

export async function markInProgress(rangeId: string, appointmentId: string) {
  await setSimpleStatus(
    rangeId,
    appointmentId,
    'in_progress',
    'Turno marcado en curso.'
  );
}

export async function markCompleted(rangeId: string, appointmentId: string) {
  await setSimpleStatus(
    rangeId,
    appointmentId,
    'completed',
    'Turno marcado como atendido.'
  );
}
