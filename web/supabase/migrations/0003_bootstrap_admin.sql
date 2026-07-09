-- Fix del trigger (ammette i contesti server) + promozione del primo admin.
-- Sostituisci l'email con quella dell'utente creato in Authentication → Users.

create or replace function public.prevent_role_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Solo un admin può cambiare il ruolo';
  end if;
  return new;
end;
$$;

update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'accessi@mediared.it');
