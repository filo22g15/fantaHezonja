-- Proposte di scambio: i membri propongono, gli admin accettano/rifiutano.
create table if not exists public.trade_proposals (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id),
  proposer    text,                 -- nome di chi propone (snapshot)
  teams       jsonb not null default '[]'::jsonb,   -- squadre coinvolte
  moves       jsonb not null default '[]'::jsonb,   -- lista mosse (per nome/descrittore, non indice)
  note        text,
  status      text not null default 'pending' check (status in ('pending','accepted','rejected')),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id)
);
alter table public.trade_proposals enable row level security;

-- tutti gli autenticati vedono le proposte (trasparenza in lega)
drop policy if exists "proposals read" on public.trade_proposals;
create policy "proposals read" on public.trade_proposals
  for select using (auth.role() = 'authenticated');

-- un membro inserisce solo proposte a proprio nome
drop policy if exists "proposals insert own" on public.trade_proposals;
create policy "proposals insert own" on public.trade_proposals
  for insert with check (auth.uid() = created_by);

-- solo gli admin cambiano lo stato (accetta/rifiuta)
drop policy if exists "proposals update admin" on public.trade_proposals;
create policy "proposals update admin" on public.trade_proposals
  for update using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.trade_proposals to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;
