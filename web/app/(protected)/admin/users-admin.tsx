'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { resetPassword, setUserName, setUserTeam, type MemberRow } from '@/app/actions/admin-users';

export default function UsersAdmin({ members, teams }: { members: MemberRow[]; teams: string[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function doReset(m: MemberRow) {
    const pw = prompt(`Nuova password per ${m.email} (min 6 caratteri):`);
    if (!pw) return;
    setBusy(m.id);
    const res = await resetPassword(m.id, pw);
    setBusy(null);
    if (res.ok) alert(`Password aggiornata per ${m.email}.\n\nComunicagli:\n${pw}`);
    else alert('Errore: ' + res.error);
  }

  async function changeTeam(m: MemberRow, teamName: string) {
    setBusy(m.id);
    const res = await setUserTeam(m.id, teamName);
    setBusy(null);
    if (res.ok) router.refresh();
    else alert('Errore: ' + res.error);
  }

  async function changeName(m: MemberRow) {
    const name = prompt(`Nome (da General Manager) per ${m.email}:`, m.display_name ?? '');
    if (name === null) return;
    setBusy(m.id);
    const res = await setUserName(m.id, name);
    setBusy(null);
    if (res.ok) router.refresh();
    else alert('Errore: ' + res.error);
  }

  return (
    <>
      <div className="eyebrow">Gestione accessi</div>
      <h2 className="title">Utenti</h2>

      <div className="tablewrap tbl-cards">
        <table>
          <thead>
            <tr>
              <th>Email</th>
              <th>Nome</th>
              <th>Ruolo</th>
              <th>Squadra</th>
              <th>Password</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td className="pname cardtitle" data-label="Email">
                  {m.email}
                </td>
                <td data-label="Nome">
                  {m.display_name ?? '—'}{' '}
                  <button
                    className="saltoggle"
                    type="button"
                    disabled={busy === m.id}
                    onClick={() => changeName(m)}
                    title="Modifica il nome (General Manager)"
                  >
                    ✎
                  </button>
                </td>
                <td data-label="Ruolo">
                  <span className={`st ${m.role === 'admin' ? 'fa' : 'attivo'}`}>{m.role}</span>
                </td>
                <td data-label="Squadra">
                  <select
                    className="teamsel"
                    value={m.team_name ?? ''}
                    disabled={busy === m.id}
                    onChange={(e) => changeTeam(m, e.target.value)}
                  >
                    <option value="">— nessuna —</option>
                    {teams.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="actcell" data-label="Password">
                  <button
                    className="saltoggle"
                    type="button"
                    disabled={busy === m.id}
                    onClick={() => doReset(m)}
                    title="Imposta una nuova password"
                  >
                    🔑 Reimposta
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="note">
        Supabase salva le password cifrate: non è possibile rileggere l&apos;originale. Qui ne imposti
        una nuova e la comunichi al membro. Puoi anche assegnare/cambiare la squadra di ciascuno.
      </p>
    </>
  );
}
