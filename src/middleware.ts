import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  const { supabaseResponse, supabase, user } = await updateSession(request);

  // No hay sesión -> a /login, conservando a dónde quería ir.
  if (!user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirectTo', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Hay sesión, pero hay que confirmar que sea admin (tabla profiles).
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set(
      'error',
      'Esta cuenta no tiene permisos de administrador'
    );
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}

export const config = {
  // Corre solo sobre /admin y todo lo que cuelgue de ahí.
  matcher: ['/admin/:path*'],
};
