'use client';

import { useFormStatus } from 'react-dom';
import { retryFailedWhatsAppMessage } from './actions';
import type { WhatsappOutboxType } from '@/types/database.types';

function RetryButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-10 rounded-lg border border-[#D9B5BD] bg-white px-3 py-2 text-sm font-semibold text-[#7A2E43] transition hover:bg-[#F3E4E8] disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? 'Reencolando…' : 'Reintentar envío'}
    </button>
  );
}

export function RetryWhatsAppButton({
  rangeId,
  outboxId,
  messageType,
}: {
  rangeId: string;
  outboxId: string;
  messageType: Extract<WhatsappOutboxType, 'confirmation' | 'cancellation'>;
}) {
  const action = retryFailedWhatsAppMessage.bind(null, rangeId, outboxId);
  const messageLabel = messageType === 'cancellation' ? 'cancelación' : 'confirmación';

  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (
          !window.confirm(
            `¿Reintentar el envío del mensaje de ${messageLabel}? Se habilitará el número y se reiniciará el contador de intentos.`
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <RetryButton />
    </form>
  );
}
