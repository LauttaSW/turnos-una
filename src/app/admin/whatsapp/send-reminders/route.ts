import { NextResponse } from 'next/server';
import { sendDueReminders } from '@/lib/whatsapp-outbox';

export const dynamic = 'force-dynamic';

// A propósito NO está enganchado al polling de 25s: los recordatorios
// son una tarea de una vez al día, no algo que tenga sentido re-buscar
// cada 25 segundos mientras el admin tenga la pestaña abierta. Para
// este prototipo local, se llama a mano (o desde un cron externo más
// adelante — ver instrucciones).
export async function GET() {
  const result = await sendDueReminders();
  return NextResponse.json(result);
}
