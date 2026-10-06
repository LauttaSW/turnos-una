'use server';

import { createClient } from '@/lib/supabase/server';

export async function login(formData: FormData): Promise<{ error?: string; destination?: string }> {
  const email = (formData.get('email') as string | null)?.trim();
  const password = formData.get('password') as string | null;
  const redirectTo = formData.get('redirectTo') as string | null;

  if (!email || !password) {
    return { error: 'Completá email y contraseña' };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    return { error: 'Email o contraseña incorrectos' };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, admin_view')
    .eq('id', data.user.id)
    .single();

  if (profile?.role !== 'admin') {
    await supabase.auth.signOut();
    return { error: 'Esta cuenta no tiene permisos de administrador' };
  }

  const destination = redirectTo?.startsWith('/admin')
    ? redirectTo
    : profile.admin_view === 'mobile'
      ? '/admin/movil'
      : '/admin/turnos';
  return { destination };
}
