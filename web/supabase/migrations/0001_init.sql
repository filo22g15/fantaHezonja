-- FantaNBA — schema iniziale: profili/ruoli + stato lega (JSONB) + RLS.
-- Eseguibile dalla dashboard Supabase (SQL Editor) o via CLI supabase db push.

-- ── profiles ────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  team_name    text,
  role         text not null default 'member' check (role in ('admin','member')),
  created_at   timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- profilo creato in automatico alla registrazione dell'utente
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', new.email));
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- helper: l'utente corrente è admin?
create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- impedisce a un MEMBRO loggato di auto-promuoversi dal client.
-- I contesti server (SQL Editor, service_role) hanno auth.uid() null e sono ammessi:
-- servono per il bootstrap del primo admin e per le operazioni amministrative.
create or replace function public.prevent_role_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null      -- c'è un utente loggato che sta modificando
     and not public.is_admin() then
    raise exception 'Solo un admin può cambiare il ruolo';
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_prevent_role_change on public.profiles;
create trigger profiles_prevent_role_change
  before update on public.profiles
  for each row execute function public.prevent_role_change();

drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles
  for select using (auth.uid() = id or public.is_admin());

drop policy if exists "profiles update self" on public.profiles;
create policy "profiles update self" on public.profiles
  for update using (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());

-- ── league_state (riga singola id=1) ────────────────────────────────────────
create table if not exists public.league_state (
  id         int primary key default 1 check (id = 1),
  data       jsonb not null default '{}'::jsonb,   -- = window.LEAGUE
  bacheca    jsonb not null default '{}'::jsonb,   -- = window.BACHECA
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
alter table public.league_state enable row level security;

drop policy if exists "league read" on public.league_state;
create policy "league read" on public.league_state
  for select using (auth.role() = 'authenticated');

drop policy if exists "league insert admin" on public.league_state;
create policy "league insert admin" on public.league_state
  for insert with check (public.is_admin());

drop policy if exists "league update admin" on public.league_state;
create policy "league update admin" on public.league_state
  for update using (public.is_admin()) with check (public.is_admin());

-- ── storico pubblicazioni (audit/rollback) ──────────────────────────────────
create table if not exists public.league_state_history (
  id         bigint generated always as identity primary key,
  data       jsonb not null,
  bacheca    jsonb not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  note       text
);
alter table public.league_state_history enable row level security;

drop policy if exists "history read" on public.league_state_history;
create policy "history read" on public.league_state_history
  for select using (auth.role() = 'authenticated');

drop policy if exists "history insert admin" on public.league_state_history;
create policy "history insert admin" on public.league_state_history
  for insert with check (public.is_admin());
