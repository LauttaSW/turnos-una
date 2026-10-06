'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const NAV_ITEMS = [
  { href: '/admin/calendario', label: 'Calendario de turnos' },
  { href: '/admin/turnos', label: 'Turnos' },
] as const;

const BASE_TITLE = 'Panel de turnos';
const POLL_INTERVAL_MS = 25_000;

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

/**
 * Concentra todo lo "vivo" del sidebar en un solo lugar: el badge de
 * pendientes junto a "Turnos", el aviso de cancelaciones recientes, y
 * el document.title de la pestaña. Los tres dependen del mismo estado
 * (que viene de un único polling), así que separarlos en varios
 * Client Components terminaría disparando el mismo fetch más de una
 * vez en paralelo sin necesidad.
 *
 * Reemplaza a PendingTitleUpdater.tsx, que ya no hace falta.
 */
export function AdminSidebarNav({
  initialPendingCount,
  initialRecentCancellationsCount,
  initialFailedConfirmationCount,
}: Props) {
  const [pendingCount, setPendingCount] = useState(initialPendingCount);
  const [recentCancellationsCount, setRecentCancellationsCount] = useState(
    initialRecentCancellationsCount
  );
  const [failedConfirmationCount, setFailedConfirmationCount] = useState(
    initialFailedConfirmationCount
  );

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const response = await fetch('/admin/notifications', {
          cache: 'no-store',
        });

        if (!response.ok) return;

        const data = (await response.json()) as NotificationsResponse;

        if (!cancelled) {
          setPendingCount(data.pendingCount);
          setRecentCancellationsCount(data.recentCancellationsCount);
          setFailedConfirmationCount(data.failedConfirmationCount);
        }
      } catch (error) {
        // Un polling de fondo que falla una vez no amerita mostrarle
        // nada al admin: se reintenta solo en el próximo ciclo.
        console.error('Error al actualizar notificaciones del admin:', error);
      }
    }

    const intervalId = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    document.title =
      pendingCount > 0 ? `(${pendingCount}) ${BASE_TITLE}` : BASE_TITLE;

    return () => {
      document.title = BASE_TITLE;
    };
  }, [pendingCount]);

  return (
    <>
      {recentCancellationsCount > 0 && (
        <div
          role="status"
          className="mt-4 rounded-md bg-[#FBEAEA] px-3 py-2 text-xs font-medium text-[#8C3B3B]"
        >
          {recentCancellationsCount}{' '}
          {recentCancellationsCount === 1
            ? 'cancelación reciente'
            : 'cancelaciones recientes'}{' '}
          (última hora)
        </div>
      )}

      {failedConfirmationCount > 0 && (
        <Link
          href="/admin/turnos"
          role="alert"
          className="mt-3 block rounded-md border border-[#E3B3B3] bg-[#FBEAEA] px-3 py-2 text-xs font-medium text-[#8C3B3B] hover:bg-[#F6DEDE]"
        >
          No se logró enviar la confirmación del turno
          {failedConfirmationCount > 1 ? ` (${failedConfirmationCount})` : ''}
        </Link>
      )}

      <nav className="mt-5 flex gap-1 overflow-x-auto md:mt-8 md:flex-1 md:flex-col md:gap-1.5 md:overflow-visible">
        {NAV_ITEMS.map((item) => {
          const badge = item.href === '/admin/turnos' ? pendingCount : 0;

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center justify-between gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm text-[#4A423E] transition hover:bg-[#F3E4E8] hover:text-[#7A2E43] lg:px-4 lg:py-2.5 lg:text-[0.925rem]"
            >
              <span>{item.label}</span>
              {badge > 0 && (
                <span className="inline-flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-[#C0392B] px-1.5 text-[11px] font-semibold leading-none text-white">
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
