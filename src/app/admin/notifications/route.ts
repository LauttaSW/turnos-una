import { NextResponse } from 'next/server';
import {
  getPendingAppointmentsCount,
  getRecentCancellationsCount,
} from '@/lib/appointments';
import { flushWhatsAppOutbox } from '@/lib/whatsapp-outbox';

// Nunca cachear: cada poll tiene que reflejar el estado actual.
export const dynamic = 'force-dynamic';

// Vive DENTRO de /admin a propósito: el matcher del middleware ya es
// '/admin/:path*', así que esta ruta queda protegida (requiere sesión
// + role=admin) sin tocar el middleware ni duplicar ese chequeo acá.
//
// El flush de whatsapp_outbox se hace acá adentro, no en un timer
// aparte: el polling del sidebar (cada ~25s) ya es exactamente el
// "tick" que hacía falta para reintentar mensajes fallidos, así que
// no hace falta un segundo mecanismo en el cliente. AdminSidebarNav
// no necesita ningún cambio — solo lee pendingCount y
// recentCancellationsCount, y ese campo extra lo ignora.
export async function GET() {
  const [pendingCount, recentCancellationsCount, outboxResult] =
    await Promise.all([
      getPendingAppointmentsCount(),
      getRecentCancellationsCount(),
      flushWhatsAppOutbox(),
    ]);

  return NextResponse.json({
    pendingCount,
    recentCancellationsCount,
    whatsappOutbox: outboxResult,
  });
}
