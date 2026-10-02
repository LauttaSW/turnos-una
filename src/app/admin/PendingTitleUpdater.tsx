'use client';

import { useEffect } from 'react';

const BASE_TITLE = 'Panel de turnos';

/**
 * No renderiza nada visible — solo el efecto secundario de cambiar
 * document.title, que por ser una API del navegador no se puede hacer
 * desde un Server Component. Vive montado en el layout de /admin, así
 * que corre en cualquier pantalla del panel.
 */
export function PendingTitleUpdater({
  pendingCount,
}: {
  pendingCount: number;
}) {
  useEffect(() => {
    document.title =
      pendingCount > 0 ? `(${pendingCount}) ${BASE_TITLE}` : BASE_TITLE;

    // Si el componente se desmonta (el admin navega fuera de /admin),
    // no dejamos un contador viejo pegado en el título de otra pantalla.
    return () => {
      document.title = BASE_TITLE;
    };
  }, [pendingCount]);

  return null;
}
