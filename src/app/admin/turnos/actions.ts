'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

async function setAppointmentStatus(
  rangeId: string,
  appointmentId: string,
  newStatus: 'confirmed' | 'cancelled'
) {
  const supabase = await createClient();

  // No hace falta tocar confirmed_at/cancelled_at a mano: el trigger
  // sync_status_timestamps de la DB los sincroniza solo al cambiar status.
  const { error } = await supabase
    .from('appointments')
    .update({ status: newStatus })
    .eq('id', appointmentId);

  if (error) {
    console.error('Error al actualizar appointment:', error);
    redirect(
      `/admin/turnos/${rangeId}?error=${encodeURIComponent(
        'No se pudo actualizar el turno. Probá de nuevo.'
      )}`
    );
  }

  revalidatePath(`/admin/turnos/${rangeId}`);
  revalidatePath('/admin/turnos');

  redirect(
    `/admin/turnos/${rangeId}?success=${encodeURIComponent(
      newStatus === 'confirmed' ? 'Turno confirmado.' : 'Turno cancelado.'
    )}`
  );
}

export async function confirmAppointment(rangeId: string, appointmentId: string) {
  await setAppointmentStatus(rangeId, appointmentId, 'confirmed');
}

export async function cancelAppointment(rangeId: string, appointmentId: string) {
  await setAppointmentStatus(rangeId, appointmentId, 'cancelled');
}
