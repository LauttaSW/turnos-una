-- WhatsApp retries, final-failure notifications, and disabled destinations.
-- Run once in the Supabase SQL Editor before deploying the application changes.

alter table public.whatsapp_outbox
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by uuid references auth.users(id) on delete set null;

create index if not exists whatsapp_outbox_pending_retry_idx
  on public.whatsapp_outbox (updated_at, created_at)
  where status = 'pending';

create index if not exists whatsapp_outbox_failed_confirmation_idx
  on public.whatsapp_outbox (created_at)
  where type = 'confirmation' and status = 'failed' and resolved_at is null;

create table if not exists public.whatsapp_blocked_phones (
  phone_digits text primary key
    check (phone_digits ~ '^[0-9]{1,20}$'),
  phone text not null,
  reason text not null,
  appointment_id uuid references public.appointments(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Los fallos definitivos existentes también deben quedar bloqueados y
-- visibles después de desplegar la nueva lógica.
insert into public.whatsapp_blocked_phones (
  phone_digits,
  phone,
  reason,
  appointment_id
)
select distinct on (regexp_replace(outbox.phone, '[^0-9]', '', 'g'))
  regexp_replace(outbox.phone, '[^0-9]', '', 'g'),
  outbox.phone,
  coalesce(outbox.last_error, 'Mensaje fallido antes de activar los reintentos nuevos.'),
  outbox.appointment_id
from public.whatsapp_outbox as outbox
where outbox.status = 'failed'
  and outbox.resolved_at is null
  and regexp_replace(outbox.phone, '[^0-9]', '', 'g') ~ '^[0-9]{1,20}$'
order by regexp_replace(outbox.phone, '[^0-9]', '', 'g'), outbox.created_at desc
on conflict (phone_digits) do nothing;

alter table public.whatsapp_blocked_phones enable row level security;

revoke all on public.whatsapp_blocked_phones from anon;
grant select, insert, update, delete on public.whatsapp_blocked_phones to authenticated;
grant all on public.whatsapp_blocked_phones to service_role;
grant select, insert, update on public.whatsapp_outbox to service_role;

drop policy if exists "Admins manage blocked WhatsApp phones"
  on public.whatsapp_blocked_phones;
create policy "Admins manage blocked WhatsApp phones"
  on public.whatsapp_blocked_phones
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
