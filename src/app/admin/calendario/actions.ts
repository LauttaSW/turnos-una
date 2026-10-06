'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { buildDefaultTitle, todayIso } from '@/lib/dates';
import {
  generateDateRangeSlug,
  type DateRangeRow,
} from '@/types/database.types';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function fail(message: string): never {
  redirect(`/admin/calendario?error=${encodeURIComponent(message)}`);
}

export async function createDateRange(formData: FormData): Promise<void> {
  const startDate = (formData.get('start_date') as string | null)?.trim() ?? '';
  const endDate = (formData.get('end_date') as string | null)?.trim() ?? '';
  const customTitle = (formData.get('title') as string | null)?.trim() ?? '';

  // --- Validaciones ---
  // Los inputs type="date" llegan como 'YYYY-MM-DD', formato en el que
  // el orden lexicográfico coincide con el cronológico: se pueden
  // comparar como strings sin construir objetos Date.
  if (!ISO_DATE.test(startDate) || !ISO_DATE.test(endDate)) {
    fail('Completá la fecha de inicio y la de fin');
  }

  if (endDate < startDate) {
    fail('La fecha de fin no puede ser anterior a la de inicio');
  }

  if (startDate < todayIso()) {
    fail('La fecha de inicio no puede estar en el pasado');
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const title = customTitle || buildDefaultTitle(startDate, endDate);

  // El slug lleva un sufijo aleatorio, así que la colisión es muy
  // improbable — pero el índice único de la DB es la garantía real, así
  // que si choca (código 23505) reintentamos con otro sufijo.
  let lastError: string | null = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    const { error } = await supabase.from('date_ranges').insert({
      title,
      start_date: startDate,
      end_date: endDate,
      slug: generateDateRangeSlug(startDate, endDate),
      created_by: user.id,
    });

    if (!error) {
      revalidatePath('/admin/calendario');
      redirect(
        `/admin/calendario?success=${encodeURIComponent(`Se creó "${title}"`)}`
      );
    }

    if (error.code !== '23505') {
      console.error('Error al crear date_range:', error);
      lastError = error.message;
      break;
    }
  }

  fail(
    lastError
      ? `No se pudo crear el rango: ${lastError}`
      : 'No se pudo crear el rango. Probá de nuevo.'
  );
}

export async function listDateRanges(): Promise<DateRangeRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('date_ranges')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`No se pudieron cargar los rangos: ${error.message}`);
  }

  return data ?? [];
}

export async function deleteDateRange(formData: FormData): Promise<void> {
  const rangeId = formData.get('rangeId');
  if (typeof rangeId !== 'string' || !rangeId.trim()) {
    fail('No se indicó un rango válido');
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

  const { error } = await supabase
    .from('date_ranges')
    .delete()
    .eq('id', rangeId);

  if (error) {
    console.error('Error al eliminar date_range:', error);
    fail(
      error.code === '23503'
        ? 'No se pudo eliminar: hay turnos asociados y la base no permite borrarlos en cascada.'
        : 'No se pudo eliminar el rango. Probá de nuevo.'
    );
  }

  revalidatePath('/admin/calendario');
  revalidatePath('/admin/turnos');
  redirect('/admin/calendario?success=Se%20elimin%C3%B3%20el%20rango');
}
