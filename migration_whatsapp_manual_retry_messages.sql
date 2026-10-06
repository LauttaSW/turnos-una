-- Habilita reintentos manuales de confirmaciones y cancelaciones desde
-- la tarjeta del turno. Aplicar después de migration_whatsapp_retry_notifications.sql.

create or replace function public.admin_retry_failed_whatsapp_message(
  p_outbox_id uuid,
  p_date_range_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  failed_message public.whatsapp_outbox%rowtype;
  appointment_status text;
  digits text;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Solo un administrador autenticado puede reintentar mensajes.';
  end if;

  select outbox.*
  into failed_message
  from public.whatsapp_outbox as outbox
  join public.appointments as appointment
    on appointment.id = outbox.appointment_id
  where outbox.id = p_outbox_id
    and appointment.date_range_id = p_date_range_id
    and outbox.type in ('confirmation', 'cancellation')
    and outbox.status = 'failed'
    and outbox.resolved_at is null
  for update of outbox, appointment;

  if not found then
    raise exception 'No se encontró un mensaje fallido activo para este turno.';
  end if;

  select appointment.status::text
  into appointment_status
  from public.appointments as appointment
  where appointment.id = failed_message.appointment_id;

  if failed_message.type = 'confirmation'
    and appointment_status not in ('confirmed', 'in_progress', 'completed') then
    raise exception 'Solo se puede reintentar la confirmación de un turno activo.';
  end if;

  if failed_message.type = 'cancellation'
    and appointment_status not in ('cancelled', 'cancelled_by_client') then
    raise exception 'Solo se puede reintentar la cancelación de un turno cancelado.';
  end if;

  digits := regexp_replace(failed_message.phone, '[^0-9]', '', 'g');

  update public.whatsapp_outbox
  set status = 'pending',
      attempts = 0,
      last_error = null,
      sent_at = null,
      resolved_at = null,
      resolved_by = null,
      updated_at = now() - interval '5 minutes'
  where id = p_outbox_id;

  if digits <> '' then
    delete from public.whatsapp_blocked_phones
    where phone_digits = digits;
  end if;

  return true;
end;
$$;

revoke all on function public.admin_retry_failed_whatsapp_message(uuid, uuid)
  from public, anon;
grant execute on function public.admin_retry_failed_whatsapp_message(uuid, uuid)
  to authenticated;
