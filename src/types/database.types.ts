// =====================================================================
// Tipos TypeScript para el schema de Supabase (salón de uñas)
// Compatible con el formato de `supabase gen types typescript`
// =====================================================================

export type AppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled_by_client'
  | 'cancelled';

// ---------------------------------------------------------------------
// Filas "crudas" tal como vienen de la base (Row), más los tipos para
// Insert / Update que usa el cliente de Supabase.
// ---------------------------------------------------------------------

export interface ProfileRow {
  [key: string]: unknown;
  id: string;
  full_name: string | null;
  role: 'admin';
  admin_view: 'desktop' | 'mobile';
  created_at: string;
}

export interface DateRangeRow {
  [key: string]: unknown;
  id: string;
  title: string;
  start_date: string; // formato 'YYYY-MM-DD'
  end_date: string; // formato 'YYYY-MM-DD'
  slug: string;
  created_by: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DateRangeInsert {
  [key: string]: unknown;
  title: string;
  start_date: string;
  end_date: string;
  slug: string;
  created_by: string;
  is_active?: boolean;
}

export interface DateRangeUpdate {
  [key: string]: unknown;
  title?: string;
  start_date?: string;
  end_date?: string;
  slug?: string;
  is_active?: boolean;
}

export interface AppointmentRow {
  [key: string]: unknown;
  id: string;
  date_range_id: string;
  appointment_date: string; // 'YYYY-MM-DD'
  appointment_time: string; // 'HH:mm:ss'
  client_first_name: string;
  client_last_name: string;
  client_phone: string;
  status: AppointmentStatus;
  notes: string | null;
  confirmed_at: string | null;
  cancelled_at: string | null;
  // Generados por la DB (trigger set_cancel_token) al confirmar; nunca
  // se setean a mano desde la app, por eso no están en AppointmentUpdate.
  cancel_token: string | null;
  reminder_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

// Lo que el formulario público de reserva puede insertar.
// status no se incluye: el default de la DB es 'pending' y la RLS
// exige que sea 'pending', así que ni conviene mandarlo desde el cliente.
export interface AppointmentInsert {
  [key: string]: unknown;
  date_range_id: string;
  appointment_date: string;
  appointment_time: string;
  client_first_name: string;
  client_last_name: string;
  client_phone: string;
  notes?: string | null;
}

// Lo que puede tocar un admin (confirmar/cancelar/editar notas, etc.)
export interface AppointmentUpdate {
  [key: string]: unknown;
  status?: AppointmentStatus;
  notes?: string | null;
  client_first_name?: string;
  client_last_name?: string;
  client_phone?: string;
}

// Fila de la vista pública (sin PII) que usa la página /reservar/[slug]
// para pintar qué horarios ya están ocupados. La vista excluye
// 'cancelled' (es lo único que libera un horario), así que cualquier
// otro estado cuenta como "ocupado".
export interface AppointmentSlotPublicRow {
  [key: string]: unknown;
  id: string;
  date_range_id: string;
  appointment_date: string;
  appointment_time: string;
  status: Exclude<AppointmentStatus, 'cancelled'>;
}

export type WhatsappOutboxStatus = 'pending' | 'sent' | 'failed';
export type WhatsappOutboxType = 'confirmation' | 'reminder' | 'cancellation';

export interface WhatsappOutboxRow {
  [key: string]: unknown;
  id: string;
  appointment_id: string | null;
  phone: string;
  message: string;
  type: WhatsappOutboxType | null;
  status: WhatsappOutboxStatus;
  attempts: number;
  last_error: string | null;
  created_at: string;
  sent_at: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  updated_at: string;
}

export interface WhatsappOutboxInsert {
  [key: string]: unknown;
  appointment_id?: string | null;
  phone: string;
  message: string;
  type?: WhatsappOutboxType | null;
  status?: WhatsappOutboxStatus;
  attempts?: number;
  last_error?: string | null;
}

export interface WhatsappOutboxUpdate {
  [key: string]: unknown;
  status?: WhatsappOutboxStatus;
  attempts?: number;
  last_error?: string | null;
  sent_at?: string | null;
  resolved_at?: string | null;
  resolved_by?: string | null;
}

export interface WhatsappBlockedPhoneRow {
  [key: string]: unknown;
  phone_digits: string;
  phone: string;
  reason: string;
  appointment_id: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------
// Tipo "Database" al estilo del generador oficial de Supabase.
// Reemplazá esto por el output real de `supabase gen types typescript`
// cuando tengas el proyecto linkeado; este es un stand-in equivalente.
// ---------------------------------------------------------------------
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Partial<ProfileRow> & Pick<ProfileRow, 'id'>;
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      date_ranges: {
        Row: DateRangeRow;
        Insert: DateRangeInsert;
        Update: DateRangeUpdate;
        Relationships: [];
      };
      appointments: {
        Row: AppointmentRow;
        Insert: AppointmentInsert;
        Update: AppointmentUpdate;
        Relationships: [];
      };
      whatsapp_outbox: {
        Row: WhatsappOutboxRow;
        Insert: WhatsappOutboxInsert;
        Update: WhatsappOutboxUpdate;
        Relationships: [];
      };
      whatsapp_blocked_phones: {
        Row: WhatsappBlockedPhoneRow;
        Insert: Omit<WhatsappBlockedPhoneRow, 'created_at'> & {
          created_at?: string;
        };
        Update: Partial<Omit<WhatsappBlockedPhoneRow, 'phone_digits'>>;
        Relationships: [];
      };
    };
    Views: {
      appointment_slots_public: {
        Row: AppointmentSlotPublicRow;
        Relationships: [];
      };
    };
    Functions: {
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      get_appointment_by_cancel_token: {
        Args: { p_token: string };
        Returns: {
          id: string;
          date_range_id: string;
          appointment_date: string;
          appointment_time: string;
          client_first_name: string;
          status: AppointmentStatus;
        }[];
      };
      cancel_appointment_by_token: {
        Args: { p_token: string };
        Returns: {
          success: boolean;
          message: string;
          appointment_id: string | null;
          date_range_id: string | null;
          client_first_name: string | null;
          client_last_name: string | null;
          client_phone: string | null;
          appointment_date: string | null;
          appointment_time: string | null;
        }[];
      };
    };
    Enums: {
      appointment_status: AppointmentStatus;
    };
  };
}

// ---------------------------------------------------------------------
// Helpers de dominio (no vienen de la DB, son utilidades de la app)
// ---------------------------------------------------------------------

// Los 20 horarios fijos: 10:00 a 19:30 cada 30 min.
export const AVAILABLE_TIME_SLOTS: string[] = Array.from(
  { length: 20 },
  (_, i) => {
    const totalMinutes = 10 * 60 + i * 30;
    const h = Math.floor(totalMinutes / 60)
      .toString()
      .padStart(2, '0');
    const m = (totalMinutes % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  }
);

// Genera un slug amigable a partir del título + fechas, con sufijo
// aleatorio corto para evitar colisiones sin tener que consultar la DB
// antes de insertar (igual el UNIQUE INDEX es la garantía real).
export function generateDateRangeSlug(
  startDate: string,
  endDate: string
): string {
  const fmt = (iso: string) => {
    const [, month, day] = iso.split('-');
    return `${parseInt(day, 10)}-${parseInt(month, 10)}`;
  };
  const suffix = Math.random().toString(36).slice(2, 6); // 4 chars random
  return `turnos-${fmt(startDate)}-a-${fmt(endDate)}-${suffix}`
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '');
}

export function isDateRangeExpired(dateRange: Pick<DateRangeRow, 'end_date'>): boolean {
  const todayIso = new Date().toISOString().slice(0, 10);
  return dateRange.end_date < todayIso;
}

export function isDateRangeBookable(
  dateRange: Pick<DateRangeRow, 'end_date' | 'is_active'>
): boolean {
  return dateRange.is_active && !isDateRangeExpired(dateRange);
}
