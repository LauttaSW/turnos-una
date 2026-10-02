import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Panel de turnos',
  description: 'Gestión de turnos del salón',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
