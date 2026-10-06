'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

type NotificationsResponse = {
  pendingCount: number;
  recentCancellationsCount: number;
  failedConfirmationCount: number;
};

type Props = {
  initialPendingCount: number;
  initialRecentCancellationsCount: number;
  initialFailedConfirmationCount: number;
};

const ITEMS = [
  { href: '/admin/movil', label: 'Inicio', icon: '⌂' },
  { href: '/admin/turnos', label: 'Turnos', icon: '▣' },
  { href: '/admin/calendario', label: 'Calendario', icon: '▦' },
] as const;

export function AdminMobileNav({
  initialPendingCount,
  initialRecentCancellationsCount,
  initialFailedConfirmationCount,
}: Props) {
  const pathname = usePathname();
  const [notifications, setNotifications] = useState<NotificationsResponse>({
    pendingCount: initialPendingCount,
    recentCancellationsCount: initialRecentCancellationsCount,
    failedConfirmationCount: initialFailedConfirmationCount,
  });

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const response = await fetch('/admin/notifications', { cache: 'no-store' });
        if (!response.ok) return;
        const data = (await response.json()) as NotificationsResponse;
        if (!cancelled) setNotifications(data);
      } catch (error) {
        console.error('Error al actualizar notificaciones del admin:', error);
      }
    }
    const intervalId = window.setInterval(poll, 25_000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <>
      {(notifications.failedConfirmationCount > 0 || notifications.recentCancellationsCount > 0) && (
        <div className="fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-2xl flex-col gap-2 px-3">
          {notifications.failedConfirmationCount > 0 && (
            <Link href="/admin/turnos" role="alert" className="rounded-xl border border-[#E3B3B3] bg-[#FBEAEA] px-4 py-3 text-sm font-medium text-[#8C3B3B] shadow-lg">
              No se logró enviar la confirmación del turno{notifications.failedConfirmationCount > 1 ? ` (${notifications.failedConfirmationCount})` : ''}
            </Link>
          )}
          {notifications.recentCancellationsCount > 0 && (
            <Link href="/admin/turnos" role="status" className="rounded-xl border border-[#E8DED7] bg-white px-4 py-3 text-sm text-[#4A423E] shadow-lg">
              {notifications.recentCancellationsCount} cancelación{notifications.recentCancellationsCount === 1 ? '' : 'es'} reciente{notifications.recentCancellationsCount === 1 ? '' : 's'}
            </Link>
          )}
        </div>
      )}
      <nav aria-label="Navegación principal" className="fixed inset-x-0 bottom-0 z-20 border-t border-[#E8DED7] bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(43,35,32,0.06)] backdrop-blur">
        <ul className="mx-auto flex max-w-2xl">
          {ITEMS.map((item) => {
            const active = pathname === item.href || (item.href !== '/admin/movil' && pathname.startsWith(item.href));
            return (
              <li key={item.href} className="flex-1">
                <Link href={item.href} aria-current={active ? 'page' : undefined} className={`relative flex min-h-[4.25rem] flex-col items-center justify-center gap-1 rounded-xl px-1 text-xs font-medium transition ${active ? 'text-[#8B344B]' : 'text-[#8A7D77] hover:text-[#4A423E]'}`}>
                  <span aria-hidden="true" className="text-xl leading-none">{item.icon}</span>
                  <span>{item.label}</span>
                  {item.href === '/admin/turnos' && notifications.pendingCount > 0 && (
                    <span className="absolute right-[calc(50%-1.5rem)] top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#C0392B] px-1 text-[10px] font-semibold text-white">
                      {notifications.pendingCount}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
