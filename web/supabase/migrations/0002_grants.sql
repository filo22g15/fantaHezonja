-- GRANT di tabella per i ruoli Supabase.
-- Necessario perché la RLS agisce SOPRA i privilegi di tabella: senza GRANT, anche
-- una riga permessa dalla policy viene negata ("permission denied for table").
-- service_role bypassa la RLS; anon/authenticated restano governati dalle policy.

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on public.profiles              to anon, authenticated, service_role;
grant select, insert, update, delete on public.league_state          to anon, authenticated, service_role;
grant select, insert, update, delete on public.league_state_history  to anon, authenticated, service_role;

grant usage, select on all sequences in schema public to anon, authenticated, service_role;

-- Anche per eventuali tabelle/sequenze future
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated, service_role;
