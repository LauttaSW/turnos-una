import Link from 'next/link';
import { fontDisplay, fontSans } from '@/lib/fonts';
import {
  getPendingAppointmentsCount,
  getFailedWhatsAppMessageCount,
  getRecentCancellationsCount,
} from '@/lib/appointments';
import { logout } from './actions';
import { AdminSidebarNav } from './AdminSidebarNav';
import { AdminMobileNav } from './AdminMobileNav';
import { createClient } from '@/lib/supabase/server';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from('profiles').select('admin_view').eq('id', user.id).maybeSingle()
    : { data: null };

  // Valores iniciales para el primer render (sin esto, el sidebar
  // arrancaría siempre en 0 hasta el primer poll). AdminSidebarNav
  // toma la posta desde acá.
  const [pendingCount, recentCancellationsCount, failedWhatsAppMessageCount] = await Promise.all([
    getPendingAppointmentsCount(),
    getRecentCancellationsCount(),
    getFailedWhatsAppMessageCount(),
  ]);

  if (profile?.admin_view === 'mobile') {
    return (
      <div className={`${fontSans.className} min-h-screen bg-[#FAF6F1]`}>
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-[#E8DED7] bg-white px-4 py-3 shadow-sm">
          <Link href="/admin/movil" className={`${fontDisplay.className} text-lg text-[#2B2320]`}>
            Nombre del salón
          </Link>
          <form action={logout}>
            <button type="submit" className="min-h-11 rounded-lg px-3 text-sm font-medium text-[#8A7D77] hover:bg-[#FAF6F1]">
              Salir
            </button>
          </form>
        </header>
        <main className="mx-auto min-h-[calc(100vh-4rem)] max-w-2xl px-4 pb-28 pt-5 sm:px-6">
          {children}
        </main>
        <AdminMobileNav
          initialPendingCount={pendingCount}
          initialRecentCancellationsCount={recentCancellationsCount}
          initialFailedWhatsAppMessageCount={failedWhatsAppMessageCount}
        />
      </div>
    );
  }

  return (
    <div className={`${fontSans.className} min-h-screen bg-[#FAF6F1] md:flex`}>
      <aside className="border-b border-[#E8DED7] bg-white px-5 py-5 md:flex md:w-64 md:shrink-0 md:flex-col md:border-b-0 md:border-r md:px-6 md:py-8 lg:w-72 lg:px-8 lg:py-10 xl:w-80">
        <Link
          href="/admin"
          className={`${fontDisplay.className} block text-lg text-[#2B2320] lg:text-xl`}
        >
          Nombre del salón
        </Link>

        <AdminSidebarNav
          initialPendingCount={pendingCount}
          initialRecentCancellationsCount={recentCancellationsCount}
          initialFailedWhatsAppMessageCount={failedWhatsAppMessageCount}
        />

        <form action={logout} className="mt-5 md:mt-auto">
          <button
            type="submit"
            className="w-full rounded-md border border-[#E8DED7] px-3 py-2 text-left text-sm text-[#8A7D77] transition hover:border-[#9B3B54]/40 hover:text-[#9B3B54]"
          >
            Cerrar sesión
          </button>
        </form>
      </aside>

      <main className="px-6 py-8 md:flex-1 md:px-12 md:py-10 lg:px-16 lg:py-12 xl:px-20">
        {children}
      </main>
    </div>
  );
}
