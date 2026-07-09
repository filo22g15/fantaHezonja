'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Primo accesso del membro: sceglie nome + squadra. Salva solo nel profilo;
// il "General Manager" delle squadre è derivato dai profili (vedi layout), non dall'Excel.
export async function joinTeam(
  teamName: string,
  name: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Non autenticato' };

  const nome = name.trim();
  if (!nome) return { ok: false, error: 'Scegli un nome' };
  if (!teamName) return { ok: false, error: 'Scegli una squadra' };

  // upsert col service role (crea la riga se il trigger non l'ha generata)
  const admin = createAdminClient();
  const { error: pe } = await admin
    .from('profiles')
    .upsert({ id: user.id, display_name: nome, team_name: teamName }, { onConflict: 'id' });
  if (pe) return { ok: false, error: pe.message };

  revalidatePath('/', 'layout');
  return { ok: true };
}

