import { Fraunces, Inter } from 'next/font/google';

// Fraunces: para el wordmark del salón y los títulos (login, encabezados
// del panel). Le da algo de identidad sin salirse de un tono profesional.
export const fontDisplay = Fraunces({
  subsets: ['latin'],
  weight: ['500', '600'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-display',
});

// Inter: para todo el resto de la UI (formularios, nav, texto de cuerpo).
export const fontSans = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-sans',
});
