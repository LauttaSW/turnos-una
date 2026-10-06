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
// Confirmar: dispara el WhatsApp de confirmación vía la cola confiable
// (sendOrQueueWhatsAppMessage). Sin cambios en esta entrega.
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
// Cancelar (admin): a diferencia de in_progress/completed, esta acción
// ahora necesita leer los datos del cliente para armar el WhatsApp, así
// que dejó de compartir setSimpleStatus — mismo patrón que
// confirmAppointment (update + select en una sola llamada).
// ---------------------------------------------------------------------
type AdminCancellationDetails = Pick<
  AppointmentRow,
  'client_first_name' | 'client_phone' | 'appointment_date' | 'appointment_time'
>;

function buildAdminCancellationMessage(appt: AdminCancellationDetails): string {
  return `Hola ${appt.client_first_name}, debido a un inconveniente se canceló tu turno del ${formatLong(
    appt.appointment_date
  )} a las ${normalizeTime(appt.appointment_time)} hs. Lamentamos las molestias.`;
}

export async function cancelAppointment(rangeId: string, appointmentId: string) {
  const supabase = await createClient();

  const { data: appt, error } = await supabase
    .from('appointments')
    .update({ status: 'cancelled' })
    .eq('id', appointmentId)
    .select('client_first_name, client_phone, appointment_date, appointment_time')
    .single<AdminCancellationDetails>();

  if (error || !appt) {
    console.error('Error al cancelar appointment:', error);
    redirect(
      `/admin/turnos/${rangeId}?error=${encodeURIComponent(
        'No se pudo cancelar el turno. Probá de nuevo.'
      )}`
    );
  }

  // Mismo criterio que al confirmar: el turno YA está cancelado acá.
  // Si Evolution falla, sendOrQueueWhatsAppMessage lo encola solo — no
  // revertimos la cancelación por esto. Esto no toca en nada el flujo
  // de cancelación por token del cliente, que vive en
  // src/app/cancelar/[token]/actions.ts y sigue igual.
  await sendOrQueueWhatsAppMessage({
    appointmentId,
    phone: appt.client_phone,
    message: buildAdminCancellationMessage(appt),
    type: 'cancellation',
  });

  revalidatePath(`/admin/turnos/${rangeId}`);
  revalidatePath('/admin/turnos');

  redirect(
    `/admin/turnos/${rangeId}?success=${encodeURIComponent('Turno cancelado.')}`
  );
}

// ---------------------------------------------------------------------
// En curso / atendido: no mandan WhatsApp, solo cambian status, así
// que siguen compartiendo esta única implementación simple.
// ---------------------------------------------------------------------
type SimpleStatus = Extract<AppointmentStatus, 'in_progress' | 'completed'>;

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

export async function updateAppointmentClient(
  rangeId: string,
  appointmentId: string,
  formData: FormData
): Promise<void> {
  const firstName = String(formData.get('client_first_name') ?? '').trim();
  const lastName = String(formData.get('client_last_name') ?? '').trim();
  const phone = String(formData.get('client_phone') ?? '').trim();
  const phoneDigits = phone.replace(/\D/g, '');

  if (!firstName || firstName.length > 80 || !lastName || lastName.length > 80) {
    redirect(
      `/admin/turnos/${rangeId}?error=${encodeURIComponent(
        'El nombre y el apellido son obligatorios y deben tener hasta 80 caracteres.'
      )}`
    );
  }

  if (phoneDigits.length < 8 || phoneDigits.length > 15) {
    redirect(
      `/admin/turnos/${rangeId}?error=${encodeURIComponent(
        'Ingresá un teléfono válido con código de país.'
      )}`
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || profile?.role !== 'admin') redirect('/login');

  const { data: previousAppointment, error: previousError } = await supabase
    .from('appointments')
    .select('client_phone')
    .eq('id', appointmentId)
    .eq('date_range_id', rangeId)
    .maybeSingle();

  if (previousError || !previousAppointment) {
    redirect(
      `/admin/turnos/${rangeId}?error=${encodeURIComponent(
        'No se encontró el turno para actualizar.'
      )}`
    );
  }

  const { data: appointment, error } = await supabase
    .from('appointments')
    .update({
      client_first_name: firstName,
      client_last_name: lastName,
      client_phone: phone,
    })
    .eq('id', appointmentId)
    .eq('date_range_id', rangeId)
    .select(
      'id, status, client_first_name, client_last_name, client_phone, appointment_date, appointment_time, cancel_token'
    )
    .single();

  if (error || !appointment) {
    console.error('Error al corregir los datos del cliente:', error);
    redirect(
      `/admin/turnos/${rangeId}?error=${encodeURIComponent(
        'No se pudieron guardar los datos del cliente.'
      )}`
    );
  }

  const previousPhoneDigits = previousAppointment.client_phone.replace(/\D/g, '');
  const phoneChanged = previousPhoneDigits !== phoneDigits;
  let notice = 'Datos del cliente actualizados.';

  if (phoneChanged) {
    const now = new Date().toISOString();

    // Cierra notificaciones anteriores y frena cualquier mensaje todavía
    // pendiente al número corregido. Los fallos siguen bloqueando el número
    // anterior, pero dejan de aparecer como una incidencia sin resolver.
    const { error: resolveError } = await supabase
      .from('whatsapp_outbox')
      .update({
        resolved_at: now,
        resolved_by: user.id,
        status: 'failed',
        updated_at: now,
      })
      .eq('appointment_id', appointmentId)
      .eq('type', 'confirmation')
      .eq('status', 'pending');

    const { error: closeFailureError } = await supabase
      .from('whatsapp_outbox')
      .update({ resolved_at: now, resolved_by: user.id, updated_at: now })
      .eq('appointment_id', appointmentId)
      .eq('type', 'confirmation')
      .eq('status', 'failed')
      .is('resolved_at', null);

    if (resolveError || closeFailureError) {
      console.error('No se pudieron cerrar mensajes anteriores:', resolveError ?? closeFailureError);
    }

    if (
      ['confirmed', 'in_progress', 'completed'].includes(appointment.status)
    ) {
      const sendResult = await sendOrQueueWhatsAppMessage({
        appointmentId,
        phone,
        message: buildConfirmationMessage(appointment),
        type: 'confirmation',
      });

      if (sendResult === 'blocked') {
        notice =
          'Datos guardados. No se envió el WhatsApp porque el número nuevo está deshabilitado por un fallo anterior.';
      } else if (sendResult === 'error') {
        notice =
          'Datos guardados, pero no se pudo enviar ni poner en cola el WhatsApp. Revisá el estado del turno.';
      }
    }
  }

  revalidatePath(`/admin/turnos/${rangeId}`);
  revalidatePath('/admin/turnos');
  redirect(
    `/admin/turnos/${rangeId}?success=${encodeURIComponent(notice)}`
  );
}
