import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database.types';

/**
 * Cliente de Supabase para usar en Client Components ('use client').
 * Crea una instancia nueva por llamada; llamalo dentro del componente
 * (o en un hook), no como singleton a nivel de módulo.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
