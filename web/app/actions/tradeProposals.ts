'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { applyMoves, type Move } from '@/lib/league/trade';
import type { League } from '@/lib/league/types';

export interface ActionResult {
  ok: boolean;
  error?: string;
  info?: string;
}

// Membro: propone uno scambio (stato pending).
export async function proposeTrade(teams: string[], moves: Move[], note: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Non autenticato' };
  if (!moves.length) return { ok: false, error: 'Nessuna mossa nello scambio' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, role, team_name')
    .eq('id', user.id)
    .single();

  // Un membro può proporre solo scambi che coinvolgono la propria squadra.
  if (profile?.role !== 'admin' && profile?.team_name && !teams.includes(profile.team_name)) {
    return { ok: false, error: `Puoi proporre scambi solo se la tua squadra (${profile.team_name}) è coinvolta.` };
  }

  const { error } = await supabase.from('trade_proposals').insert({
    created_by: user.id,
    proposer: profile?.display_name ?? user.email,
    teams,
    moves,
    note: note || null,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath('/trade');
  return { ok: true };
}

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, isAdmin: false };
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  return { supabase, user, isAdmin: profile?.role === 'admin' };
}

// Admin: accetta una proposta → applica le mosse e pubblica.
export async function applyProposal(id: number): Promise<ActionResult> {
  const { supabase, user, isAdmin } = await requireAdmin();
  if (!user) return { ok: false, error: 'Non autenticato' };
  if (!isAdmin) return { ok: false, error: 'Solo gli admin' };

  const { data: prop } = await supabase
    .from('trade_proposals')
    .select('id, moves, status')
    .eq('id', id)
    .single();
  if (!prop) return { ok: false, error: 'Proposta non trovata' };
  if (prop.status !== 'pending') return { ok: false, error: 'Proposta già gestita' };

  const { data: row } = await supabase.from('league_state').select('data, bacheca').eq('id', 1).single();
  if (!row) return { ok: false, error: 'Stato lega non trovato' };

  const draft = JSON.parse(JSON.stringify(row.data)) as League;
  const { applied, skipped } = applyMoves(draft, prop.moves as Move[]);
  if (!applied) return { ok: false, error: 'Nessuna mossa applicabile (rosa cambiata?)' };

  const { error: e1 } = await supabase
    .from('league_state')
    .update({ data: draft, updated_at: new Date().toISOString(), updated_by: user.id })
    .eq('id', 1);
  if (e1) return { ok: false, error: e1.message };

  await supabase
    .from('league_state_history')
    .insert({ data: draft, bacheca: row.bacheca, created_by: user.id, note: `Trade accettato #${id}` });

  await supabase
    .from('trade_proposals')
    .update({ status: 'accepted', resolved_at: new Date().toISOString(), resolved_by: user.id })
    .eq('id', id);

  revalidatePath('/');
  revalidatePath('/trade');
  return { ok: true, info: skipped ? `${applied} applicate, ${skipped} saltate (non più valide).` : undefined };
}

// Admin: rifiuta una proposta (nessuna modifica alla lega).
export async function rejectProposal(id: number): Promise<ActionResult> {
  const { supabase, user, isAdmin } = await requireAdmin();
  if (!user) return { ok: false, error: 'Non autenticato' };
  if (!isAdmin) return { ok: false, error: 'Solo gli admin' };

  const { error } = await supabase
    .from('trade_proposals')
    .update({ status: 'rejected', resolved_at: new Date().toISOString(), resolved_by: user.id })
    .eq('id', id)
    .eq('status', 'pending');
  if (error) return { ok: false, error: error.message };

  revalidatePath('/trade');
  return { ok: true };
}
