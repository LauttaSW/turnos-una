import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

/**
 * Cliente privilegiado exclusivamente para operaciones del servidor que
 * también se ejecutan desde flujos públicos, como registrar WhatsApp.
 * Nunca importar desde componentes cliente ni exponer su clave.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Falta configurar SUPABASE_SECRET_KEY (recomendado) o SUPABASE_SERVICE_ROLE_KEY en el servidor.'
    );
  }

  return createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}
