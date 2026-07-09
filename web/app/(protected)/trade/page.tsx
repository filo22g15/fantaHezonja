import { createClient } from '@/lib/supabase/server';
import TradeView, { type Proposal } from './trade-view';

export const dynamic = 'force-dynamic';

export default async function TradePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, team_name')
    .eq('id', user!.id)
    .single();
  const isAdmin = profile?.role === 'admin';

  // Admin: tutte le proposte in sospeso. Membro: le proprie (tutti gli stati).
  const query = supabase.from('trade_proposals').select('*').order('created_at', { ascending: false });
  const { data: proposals } = isAdmin
    ? await query.eq('status', 'pending')
    : await query.eq('created_by', user!.id);

  return (
    <TradeView
      isAdmin={isAdmin}
      myTeam={profile?.team_name ?? null}
      proposals={(proposals as Proposal[]) ?? []}
    />
  );
}
