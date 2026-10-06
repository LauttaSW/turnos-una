import { NextResponse } from 'next/server';
import { flushWhatsAppOutbox } from '@/lib/whatsapp-outbox';

export const dynamic = 'force-dynamic';

// Procesa los mensajes que ya cumplieron la espera de cinco minutos.
// No saltea el intervalo configurado en whatsapp-outbox.
export async function GET() {
  const result = await flushWhatsAppOutbox();
  return NextResponse.json(result);
}
