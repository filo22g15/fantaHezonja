// Pagina Utenti (solo admin): reset password + assegnazione squadra.
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { listMembers } from '@/app/actions/admin-users';
import type { League } from '@/lib/league/types';
import UsersAdmin from './users-admin';

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') {
    return (
      <main style={{ padding: 24, fontFamily: 'system-ui' }}>
        <h2>Area riservata</h2>
        <p style={{ color: 'var(--muted)' }}>Non hai i permessi di admin.</p>
      </main>
    );
  }

  const [members, { data: row }] = await Promise.all([
    listMembers(),
    supabase.from('league_state').select('data').eq('id', 1).single(),
  ]);
  const teams = ((row?.data as League)?.teams ?? []).map((t) => t.name).sort();

  return <UsersAdmin members={members} teams={teams} />;
}
