'use client';

import { useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';

type Props = {
  action: (formData: FormData) => void | Promise<void>;
};

function ConfirmSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="flex-1 rounded-md bg-[#9B3B54] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#7A2E43] focus:outline-none focus:ring-2 focus:ring-[#9B3B54]/40 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? 'Cancelando…' : 'Sí, cancelar'}
    </button>
  );
}

export function CancelConfirmButton({ action }: Props) {
  const [open, setOpen] = useState(false);

  // Permite cerrar el modal con Escape, además del click afuera.
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-md bg-[#9B3B54] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#7A2E43] focus:outline-none focus:ring-2 focus:ring-[#9B3B54]/40 focus:ring-offset-2"
      >
        Cancelar mi turno
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-cancel-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#2B2320]/40 px-6"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-xs rounded-lg bg-white p-6 text-center shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <p
              id="confirm-cancel-title"
              className="text-sm font-medium text-[#2B2320]"
            >
              ¿Confirmás que querés cancelar el turno?
            </p>

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex-1 rounded-md border border-[#E2D6CF] px-4 py-2.5 text-sm font-medium text-[#4A423E] transition hover:bg-[#F3E4E8]"
              >
                No, volver
              </button>

              {/* El form real, el que dispara la Server Action, vive
                  adentro del modal: hasta que no se confirma acá, la
                  cancelación nunca se ejecuta. */}
              <form action={action} className="flex flex-1">
                <ConfirmSubmitButton />
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
