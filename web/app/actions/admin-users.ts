'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const };
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  return { ok: profile?.role === 'admin', supabase };
}

export interface MemberRow {
  id: string;
  email: string;
  display_name: string | null;
  team_name: string | null;
  role: string;
}

export async function listMembers(): Promise<MemberRow[]> {
  const guard = await requireAdmin();
  if (!guard.ok) return [];

  const admin = createAdminClient();
  const { data: authData } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const { data: profiles } = await admin.from('profiles').select('id, display_name, team_name, role');
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

  return (authData?.users ?? []).map((u) => {
    const p = byId.get(u.id);
    return {
      id: u.id,
      email: u.email ?? '(nessuna email)',
      display_name: p?.display_name ?? null,
      team_name: p?.team_name ?? null,
      role: p?.role ?? 'member',
    };
  });
}

export async function resetPassword(
  userId: string,
  newPassword: string
): Promise<{ ok: boolean; error?: string }> {
  const guard = await requireAdmin();
  if (!guard.ok) return { ok: false, error: 'Solo gli admin' };
  if (!newPassword || newPassword.length < 6) return { ok: false, error: 'Password troppo corta (min 6)' };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, { password: newPassword });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function setUserName(
  userId: string,
  name: string
): Promise<{ ok: boolean; error?: string }> {
  const guard = await requireAdmin();
  if (!guard.ok) return { ok: false, error: 'Solo gli admin' };
  const nome = name.trim();
  if (!nome) return { ok: false, error: 'Nome vuoto' };
  const admin = createAdminClient();
  const { error } = await admin
    .from('profiles')
    .upsert({ id: userId, display_name: nome }, { onConflict: 'id' });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function setUserTeam(
  userId: string,
  teamName: string
): Promise<{ ok: boolean; error?: string }> {
  const guard = await requireAdmin();
  if (!guard.ok) return { ok: false, error: 'Solo gli admin' };
  const admin = createAdminClient();
  const { error } = await admin
    .from('profiles')
    .upsert({ id: userId, team_name: teamName || null }, { onConflict: 'id' });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
