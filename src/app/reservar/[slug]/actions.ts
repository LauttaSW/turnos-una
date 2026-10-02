'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { todayIso } from '@/lib/dates';
import { AVAILABLE_TIME_SLOTS } from '@/types/database.types';

export type BookingState =
  | { status: 'idle' }
  | { status: 'success'; message: string }
  | { status: 'error'; message: string };

// Mismo criterio que el CHECK de la tabla: opcionalmente un '+', y
// después dígitos con espacios o guiones.
const PHONE_RE = /^\+?[0-9][0-9 -]{6,18}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function error(message: string): BookingState {
  return { status: 'error', message };
}

export async function createAppointment(
  _prevState: BookingState,
  formData: FormData
): Promise<BookingState> {
  const dateRangeId = (formData.get('date_range_id') as string | null) ?? '';
  const slug = (formData.get('slug') as string | null) ?? '';
  const date = (formData.get('appointment_date') as string | null) ?? '';
  const time = (formData.get('appointment_time') as string | null) ?? '';
  const firstName =
    (formData.get('client_first_name') as string | null)?.trim() ?? '';
  const lastName =
    (formData.get('client_last_name') as string | null)?.trim() ?? '';
  const phone = (formData.get('client_phone') as string | null)?.trim() ?? '';
  const notes = (formData.get('notes') as string | null)?.trim() ?? '';

  // --- Validaciones de forma ---
  if (!dateRangeId || !ISO_DATE.test(date)) {
    return error('Elegí un día para tu turno');
  }

  if (!AVAILABLE_TIME_SLOTS.includes(time)) {
    return error('El horario elegido no es válido');
  }

  if (!firstName || !lastName) {
    return error('Completá tu nombre y apellido');
  }

  if (!PHONE_RE.test(phone)) {
    return error('Revisá el celular: por ejemplo +54 9 2346 123456');
  }

  const supabase = await createClient();

  // --- Validaciones contra la base ---
  // No confiamos en los datos que vengan del formulario: verificamos que
  // el rango exista, esté vigente y que la fecha caiga adentro.
  const { data: range } = await supabase
    .from('date_ranges')
    .select('id, start_date, end_date, is_active')
    .eq('id', dateRangeId)
    .single();

  if (!range) {
    return error('El link de reservas ya no está disponible');
  }

  const today = todayIso();

  if (!range.is_active || range.end_date < today) {
    return error('Este período de turnos ya no está disponible');
  }

  if (date < range.start_date || date > range.end_date) {
    return error('Ese día no pertenece a este período de turnos');
  }

  if (date < today) {
    return error('No se pueden reservar turnos en días pasados');
  }

  const { error: insertError } = await supabase.from('appointments').insert({
    date_range_id: dateRangeId,
    appointment_date: date,
    appointment_time: time,
    client_first_name: firstName,
    client_last_name: lastName,
    client_phone: phone,
    notes: notes || null,
  });

  if (insertError) {
    // 23505 = el índice único parcial rechazó el insert porque alguien
    // tomó ese mismo horario mientras la clienta completaba el form.
    if (insertError.code === '23505') {
      revalidatePath(`/reservar/${slug}`);
      return error(
        'Justo tomaron ese horario. Elegí otro, por favor.'
      );
    }

    console.error('Error al crear appointment:', insertError);
    return error('No pudimos enviar tu solicitud. Probá de nuevo.');
  }

  revalidatePath(`/reservar/${slug}`);

  return {
    status: 'success',
    message: 'Tu solicitud fue enviada. Te confirmaremos por WhatsApp.',
  };
}
