'use client';

import { useState } from 'react';
import { joinTeam } from '@/app/actions/profile';

export default function PickTeam({ teams }: { teams: string[] }) {
  const [name, setName] = useState('');
  const [team, setTeam] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    const res = await joinTeam(team, name);
    if (res.ok) window.location.reload();
    else {
      setError(res.error ?? 'Errore');
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 420, margin: '15vh auto', padding: 24, fontFamily: 'system-ui' }}>
      <h1 style={{ fontSize: 22, marginBottom: 6 }}>Benvenuto!</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 20 }}>
        Scegli il tuo nome (da General Manager) e la tua franchigia tra le 20. Potrai proporre scambi
        solo se la tua squadra è coinvolta.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input
          type="text"
          placeholder="Il tuo nome (GM)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ padding: 10, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--panel)', color: 'var(--ink)' }}
        />
        <select
          value={team}
          onChange={(e) => setTeam(e.target.value)}
          style={{ padding: 10, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--panel)', color: 'var(--ink)' }}
        >
          <option value="">— scegli la tua squadra —</option>
          {teams.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button
          onClick={save}
          disabled={!team || !name.trim() || busy}
          style={{ padding: 10, borderRadius: 8, border: 0, background: 'var(--ball)', color: '#101823', cursor: 'pointer', fontWeight: 600 }}
        >
          {busy ? 'Salvo…' : 'Conferma'}
        </button>
        {error && <p style={{ color: 'var(--loss)' }}>{error}</p>}
      </div>
    </main>
  );
}
