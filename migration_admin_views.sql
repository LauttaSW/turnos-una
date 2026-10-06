-- Ejecutar en el SQL Editor de Supabase.
-- Primero crea/invita belen@admin.com en Authentication > Users.

alter table public.profiles
  add column if not exists admin_view text not null default 'desktop';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_admin_view_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_admin_view_check
      check (admin_view in ('desktop', 'mobile'));
  end if;
end $$;

-- Tu cuenta conserva el panel actual.
update public.profiles as profile
set admin_view = 'desktop', role = 'admin'
from auth.users as auth_user
where profile.id = auth_user.id
  and lower(auth_user.email) = lower('Lauttymansilla@gmail.com');

-- Belén usa el panel optimizado para celular.
-- Si todavía no existe en Auth, esta sentencia no inserta filas: crear/invitar
-- el usuario en Supabase Auth y volver a ejecutar este bloque.
insert into public.profiles (id, full_name, role, admin_view)
select auth_user.id, 'Belén', 'admin', 'mobile'
from auth.users as auth_user
where lower(auth_user.email) = lower('belen@admin.com')
on conflict (id) do update
set role = 'admin',
    admin_view = 'mobile';
