import Link from 'next/link';
import { fontDisplay, fontSans } from '@/lib/fonts';
import {
  getPendingAppointmentsCount,
  getRecentCancellationsCount,
} from '@/lib/appointments';
import { logout } from './actions';
import { AdminSidebarNav } from './AdminSidebarNav';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Valores iniciales para el primer render (sin esto, el sidebar
  // arrancaría siempre en 0 hasta el primer poll). AdminSidebarNav
  // toma la posta desde acá.
  const [pendingCount, recentCancellationsCount] = await Promise.all([
    getPendingAppointmentsCount(),
    getRecentCancellationsCount(),
  ]);

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
