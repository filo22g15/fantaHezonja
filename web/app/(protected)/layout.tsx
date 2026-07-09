// Shell delle pagine protette: header (logo + nav + utente) e provider dati lega.
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { LeagueProvider } from '@/lib/league/context';
import type { Bacheca, League } from '@/lib/league/types';
import Nav from './nav';
import SignOut from './sign-out';
import AdminToggle from './admin-toggle';
import PublishBar from './publish-bar';
import PickTeam from './pick-team';
import { PlayerModalProvider } from './player-modal';

export const dynamic = 'force-dynamic';

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: profile }, { data: row }] = await Promise.all([
    supabase.from('profiles').select('display_name, role, team_name').eq('id', user.id).single(),
    supabase.from('league_state').select('data, bacheca').eq('id', 1).single(),
  ]);

  const isAdmin = profile?.role === 'admin';
  const league = (row?.data ?? { league: '', cap: 0, seasons: [], teams: [], players: [] }) as League;
  const bacheca = (row?.bacheca ?? {}) as Bacheca;

  // I membri devono collegarsi a una squadra prima di usare il sito.
  if (!isAdmin && !profile?.team_name) {
    return <PickTeam teams={league.teams.map((t) => t.name).sort()} />;
  }

  // General Manager derivato ESCLUSIVAMENTE dai profili collegati (vuoto se nessuno).
  const admin = createAdminClient();
  const { data: allProfiles } = await admin.from('profiles').select('display_name, team_name');
  const gmByTeam: Record<string, string> = {};
  for (const p of allProfiles ?? []) {
    if (p.team_name && p.display_name) {
      gmByTeam[p.team_name] = gmByTeam[p.team_name]
        ? `${gmByTeam[p.team_name]} & ${p.display_name}`
        : p.display_name;
    }
  }

  return (
    <LeagueProvider league={league} bacheca={bacheca} gmByTeam={gmByTeam} isAdmin={isAdmin}>
      <header>
        <div className="hwrap">
          <Link href="/" className="logo">
            <span className="ball" />
            <h1>
              FANTA<span>HEZONJA</span>
            </h1>
          </Link>
          <Nav isAdmin={isAdmin} />
          <span className="userbox">
            <AdminToggle />
            {profile?.display_name ?? user.email}
            {profile?.team_name && ` · ${profile.team_name}`}
            <SignOut />
          </span>
        </div>
      </header>
      <PlayerModalProvider>
        <main>{children}</main>
      </PlayerModalProvider>
      <PublishBar />
    </LeagueProvider>
  );
}
