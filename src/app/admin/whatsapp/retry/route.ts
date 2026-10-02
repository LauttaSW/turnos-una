import { NextResponse } from 'next/server';
import { flushWhatsAppOutbox } from '@/lib/whatsapp-outbox';

export const dynamic = 'force-dynamic';

// Hace lo mismo que el flush automático del polling, pero on-demand —
// útil para probar en local: levantás Evolution API y pegás acá en
// vez de esperar hasta 25s a que corra el próximo poll.
export async function GET() {
  const result = await flushWhatsAppOutbox();
  return NextResponse.json(result);
}
