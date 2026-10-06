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

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, admin_view')
    .eq('id', data.user.id)
    .maybeSingle();

  if (profileError || profile?.role !== 'admin') {
    await supabase.auth.signOut();
    return { error: 'Esta cuenta no tiene permisos de administrador' };
  }

  // /admin/login no es una sección del panel; puede llegar aquí como
  // redirectTo si alguien intentó abrir una ruta de login bajo /admin.
  const isValidAdminDestination =
    (redirectTo === '/admin' || redirectTo?.startsWith('/admin/')) &&
    !redirectTo?.startsWith('/admin/login');
  const defaultDestination =
    profile.admin_view === 'mobile' ? '/admin/movil' : '/admin/turnos';
  const destination = isValidAdminDestination
    ? redirectTo ?? defaultDestination
    : defaultDestination;
  return { destination };
}
