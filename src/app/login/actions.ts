'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function login(formData: FormData) {
  const email = (formData.get('email') as string | null)?.trim();
  const password = formData.get('password') as string | null;
  const redirectTo = formData.get('redirectTo') as string | null;

  if (!email || !password) {
    redirect(
      `/login?error=${encodeURIComponent('Completá email y contraseña')}`
    );
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    redirect(
      `/login?error=${encodeURIComponent('Email o contraseña incorrectos')}`
    );
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .single();

  if (profile?.role !== 'admin') {
    await supabase.auth.signOut();
    redirect(
      `/login?error=${encodeURIComponent(
        'Esta cuenta no tiene permisos de administrador'
      )}`
    );
  }

  const destination =
    redirectTo && redirectTo.startsWith('/admin') ? redirectTo : '/admin';

  redirect(destination);
}