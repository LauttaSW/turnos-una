'use client';

import { useState } from 'react';

export function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback para contextos sin clipboard API (http sin localhost,
      // navegadores viejos): mostramos la URL para copiarla a mano.
      window.prompt('Copiá el link:', url);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="shrink-0 rounded-md border border-[#E2D6CF] bg-white px-3 py-1.5 text-xs font-medium text-[#7A2E43] transition hover:border-[#9B3B54]/50 hover:bg-[#F3E4E8] focus:outline-none focus:ring-2 focus:ring-[#9B3B54]/30"
    >
      {copied ? '¡Copiado!' : 'Copiar link'}
    </button>
  );
}
