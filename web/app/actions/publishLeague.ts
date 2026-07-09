'use server';

// Sostituto server-side di adminPublish (index.html): niente commit su GitHub,
// scrive il JSONB in league_state. Il check ruolo è applicato sia qui sia dalla RLS.
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { Bacheca, League } from '@/lib/league/types';

export interface PublishResult {
  ok: boolean;
  error?: string;
}

export async function publishLeague(
  data: League,
  bacheca: Bacheca,
  note?: string
): Promise<PublishResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Non autenticato' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (profile?.role !== 'admin') return { ok: false, error: 'Solo gli admin possono pubblicare' };

  // upsert della riga singola (id=1). La RLS blocca comunque i non-admin.
  const { error } = await supabase
    .from('league_state')
    .upsert(
      { id: 1, data, bacheca, updated_at: new Date().toISOString(), updated_by: user.id },
      { onConflict: 'id' }
    );
  if (error) return { ok: false, error: error.message };

  // storico per audit/rollback
  await supabase
    .from('league_state_history')
    .insert({ data, bacheca, created_by: user.id, note: note ?? null });

  revalidatePath('/');
  revalidatePath('/admin');
  return { ok: true };
}
