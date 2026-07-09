'use client';

import { Fragment, useMemo, useState } from 'react';
import Link from 'next/link';
import { useLeague, caps } from '@/lib/league/context';
import { fmtFull, SalCell, Spotrac, statusOf, stClass } from '@/lib/league/format';
import type { League, Player } from '@/lib/league/types';

export default function ContrattiPage() {
  const { league, origLeague, editMode, updateLeague } = useLeague();
  const S = league.seasons;
  const CAP = caps(league)[0];

  const [q, setQ] = useState('');
  const [team, setTeam] = useState('');
  const [role, setRole] = useState('');
  const [st, setSt] = useState('');
  const [sort, setSort] = useState('n');
  const [dir, setDir] = useState(1);
  const [edit, setEdit] = useState<Set<number>>(new Set());
  const [syncing, setSyncing] = useState<number | null>(null);

  const teams = useMemo(
    () => [...new Set(league.players.map((p) => p.t).filter(Boolean))].sort(),
    [league]
  );
  const roles = useMemo(
    () => [...new Set(league.players.map((p) => p.r).filter(Boolean) as string[])].sort(),
    [league]
  );

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const withIdx = league.players.map((p, i) => ({ p, i }));
    const filtered = withIdx.filter(
      ({ p }) =>
        (!needle || p.n.toLowerCase().includes(needle)) &&
        (!team || (team === '__FA__' ? !p.t : p.t === team)) &&
        (!role || p.r === role) &&
        (!st || p.s === st)
    );
    const k = sort;
    const d = dir;
    return filtered.sort((a, b) => {
      if (k === 'n' || k === 't' || k === 'r' || k === 's') {
        const va = ((a.p[k] as string) || '').toLowerCase();
        const vb = ((b.p[k] as string) || '').toLowerCase();
        return va < vb ? -d : va > vb ? d : 0;
      }
      const i = +k;
      return d * (b.p.sal[i] - a.p.sal[i]);
    });
  }, [league, q, team, role, st, sort, dir]);

  function toggleSort(k: string) {
    if (sort === k) setDir((x) => -x);
    else {
      setSort(k);
      setDir(1);
    }
  }
  function toggleEdit(i: number) {
    setEdit((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  // ---- mutazioni admin ----
  const movePlayer = (i: number, value: string) =>
    updateLeague((d: League) => {
      d.players[i].t = value || '';
    });
  const setSal = (i: number, s: number, value: number) =>
    updateLeague((d) => {
      d.players[i].sal[s] = value;
    });
  const confermaRinnovo = (i: number) => {
    const p = league.players[i];
    if (!confirm(`Confermare il rinnovo di ${p.n}? Gli importi in giallo diventano contratto effettivo e contano nel cap.`))
      return;
    updateLeague((d) => {
      const pp = d.players[i];
      if (!pp.pnd) return;
      pp.pnd.forEach((v, k) => {
        if (v && !pp.sal[k]) pp.sal[k] = v;
      });
      delete pp.pnd;
    });
  };
  const setDeadTeam = (i: number, value: string) =>
    updateLeague((d) => {
      const p = d.players[i];
      if (!value) delete p.dead;
      else {
        if (!p.dead) p.dead = { t: '', sal: [0, 0, 0, 0, 0] };
        p.dead.t = value;
      }
    });
  const setDeadSal = (i: number, s: number, value: number) =>
    updateLeague((d) => {
      const p = d.players[i];
      if (!p.dead) p.dead = { t: '', sal: [0, 0, 0, 0, 0] };
      p.dead.sal[s] = value;
      if (!p.dead.t && !p.dead.sal.some((v) => v)) delete p.dead;
    });
  const syncFromSpotrac = async (i: number) => {
    const p = league.players[i];
    setSyncing(i);
    try {
      const r = await fetch('/api/sync-player', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: p.n }),
      });
      const data = await r.json();
      if (!r.ok) {
        alert(data.error || 'Errore nella sincronizzazione.');
        return;
      }
      if (!data.found) {
        alert(`Nessun dato trovato per ${p.n} su Spotrac/sports.ws.`);
        return;
      }
      const changes: string[] = [];
      if (data.role && data.role !== p.r) changes.push(`ruolo ${p.r || '?'} → ${data.role}`);
      (data.sal as (number | null)[]).forEach((v, idx) => {
        if (v != null && v !== p.sal[idx]) changes.push(`${S[idx]}: ${(v / 1e6).toFixed(1)}M`);
      });
      if (!changes.length) {
        alert(`${p.n}: già allineato a Spotrac/sports.ws.`);
        return;
      }
      if (!confirm(`Aggiornare ${p.n} da Spotrac/sports.ws?\n\n${changes.join('\n')}`)) return;
      updateLeague((d: League) => {
        const pp = d.players[i];
        if (data.role) pp.r = data.role;
        (data.sal as (number | null)[]).forEach((v, idx) => {
          if (v != null) pp.sal[idx] = v;
        });
      });
    } catch {
      alert('Errore di rete durante la sincronizzazione.');
    } finally {
      setSyncing(null);
    }
  };

  const addPlayer = () => {
    const n = (prompt('Nome del giocatore (come su Spotrac):') || '').trim();
    if (!n) return;
    if (league.players.some((p) => p.n.toLowerCase() === n.toLowerCase())) {
      alert(`${n} è già presente nella lista.`);
      return;
    }
    const r = (prompt('Ruolo (G / GF / F / FC / C) — opzionale:') || '').trim().toUpperCase();
    updateLeague((d: League) => {
      d.players.push({
        n,
        t: '',
        r: r || undefined,
        s: 'ATTIVO',
        sal: [0, 0, 0, 0, 0],
        opt: ['', '', '', '', ''],
      });
    });
    alert(`${n} aggiunto come free agent. Ora puoi assegnarlo a una squadra e impostarne gli stipendi (✎), poi Pubblica.`);
  };

  const arrow = (key: string) => (sort === key ? <span className="dir">{dir === 1 ? '▾' : '▴'}</span> : null);
  const Th = ({ k, label, num }: { k: string; label: string; num?: boolean }) => (
    <th className={num ? 'num' : undefined}>
      <button onClick={() => toggleSort(k)}>
        {label} {arrow(k)}
      </button>
    </th>
  );

  const teamSelect = (p: Player, i: number) => {
    const orig = origLeague.players[i]?.t || '';
    const moved = (p.t || '') !== orig;
    return (
      <select
        className={`teamsel ${moved ? 'moved' : ''}`}
        value={p.t || ''}
        onChange={(e) => movePlayer(i, e.target.value)}
        aria-label={`Sposta ${p.n}`}
      >
        <option value="">— svincolato —</option>
        {league.teams.map((t) => (
          <option key={t.name} value={t.name}>
            {t.name}
          </option>
        ))}
      </select>
    );
  };

  return (
    <>
      <div className="eyebrow">
        Stagione {S[0]} · Salary cap {fmtFull(CAP)}
      </div>
      <h2 className="title">Contratti</h2>

      <div className="toolbar">
        <input
          type="search"
          placeholder="Cerca giocatore…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Cerca giocatore"
        />
        <select value={team} onChange={(e) => setTeam(e.target.value)} aria-label="Filtra per squadra">
          <option value="">Tutte le squadre</option>
          <option value="__FA__">Free agent</option>
          {teams.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Filtra per ruolo">
          <option value="">Tutti i ruoli</option>
          {roles.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
        <select value={st} onChange={(e) => setSt(e.target.value)} aria-label="Filtra per stato">
          <option value="">Tutti gli stati</option>
          <option>ATTIVO</option>
          <option>TAGLIATO</option>
        </select>
        <span className="count">{rows.length} giocatori</span>
      </div>

      {editMode && (
        <button className="addpick" type="button" onClick={addPlayer} style={{ marginBottom: 14 }}>
          + Aggiungi giocatore
        </button>
      )}

      <div className="tablewrap tbl-cards">
        <table>
          <thead>
            <tr>
              <Th k="r" label="Ruolo" />
              <Th k="n" label="Giocatore" />
              <Th k="t" label="FantaTeam" />
              <Th k="s" label="Stato" />
              {S.map((s, i) => (
                <Th key={i} k={String(i)} label={s} num />
              ))}
              {editMode && <th />}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ p, i }) => {
              const d = p.dead || { t: '', sal: [0, 0, 0, 0, 0] };
              return (
                <Fragment key={i}>
                  <tr>
                    <td data-label="Ruolo">
                      <span className="role">{p.r || '—'}</span>
                    </td>
                    <td className="pname cardtitle" data-label="Giocatore">
                      {p.n} <Spotrac n={p.n} />
                      {p.dead && p.dead.t && (
                        <Link
                          className="deadtag"
                          href={`/squadra/${encodeURIComponent(p.dead.t)}`}
                          title={`Penale da taglio a carico di ${p.dead.t}`}
                        >
                          DM→{p.dead.t}
                        </Link>
                      )}
                    </td>
                    <td className="dim" data-label="FantaTeam">
                      {editMode ? (
                        teamSelect(p, i)
                      ) : p.t ? (
                        <Link href={`/squadra/${encodeURIComponent(p.t)}`}>{p.t}</Link>
                      ) : (
                        <span className="st fa">FREE AGENT</span>
                      )}
                    </td>
                    <td data-label="Stato">
                      <span className={`st ${stClass(statusOf(p))}`}>{p.t ? p.s || '' : ''}</span>
                    </td>
                    {p.sal.map((_, s) =>
                      editMode && edit.has(i) ? (
                        <td key={s} className="num" data-label={S[s]}>
                          <input
                            className="saledit"
                            type="number"
                            min={0}
                            step={100000}
                            defaultValue={p.sal[s] || 0}
                            onBlur={(e) => setSal(i, s, parseFloat(e.target.value) || 0)}
                          />
                        </td>
                      ) : (
                        <td key={s} className="num" data-label={S[s]}>
                          <SalCell p={p} i={s} />
                        </td>
                      )
                    )}
                    {editMode && (
                      <td className="actcell">
                        {p.pnd && p.pnd.some((v) => v) && (
                          <button
                            className="rinnova"
                            type="button"
                            onClick={() => confermaRinnovo(i)}
                            title="Conferma rinnovo: rende effettivo il contratto in giallo (entra nel cap)"
                          >
                            ✓R
                          </button>
                        )}
                        <button
                          className="saltoggle"
                          type="button"
                          disabled={syncing === i}
                          onClick={() => syncFromSpotrac(i)}
                          title="Aggiorna ruolo e contratto da Spotrac / sports.ws"
                        >
                          {syncing === i ? '…' : '🔄'}
                        </button>
                        <button
                          className={`saltoggle ${edit.has(i) ? 'on' : ''}`}
                          type="button"
                          onClick={() => toggleEdit(i)}
                          title="Modifica stipendio e penale"
                        >
                          {edit.has(i) ? '✓' : '✎'}
                        </button>
                      </td>
                    )}
                  </tr>
                  {editMode && edit.has(i) && (
                    <tr className="deadrow">
                      <td className="dim" style={{ textAlign: 'right' }}>
                        Penale (dead money) →
                      </td>
                      <td>
                        <select
                          className="deadteam"
                          value={d.t}
                          onChange={(e) => setDeadTeam(i, e.target.value)}
                          aria-label="Squadra che paga la penale"
                        >
                          <option value="">— nessuna penale —</option>
                          {league.teams.map((t) => (
                            <option key={t.name} value={t.name}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="dim" colSpan={2}>
                        metà · solo garantito
                      </td>
                      {[0, 1, 2, 3, 4].map((s) => (
                        <td key={s} className="num">
                          <input
                            className="deadsal"
                            type="number"
                            min={0}
                            step={100000}
                            defaultValue={(d.sal && d.sal[s]) || 0}
                            onBlur={(e) => setDeadSal(i, s, parseFloat(e.target.value) || 0)}
                          />
                        </td>
                      ))}
                      <td />
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="note">
        T = Team Option · P = Player Option · NG = Not Guaranteed. L&apos;icona ↗ apre il profilo del
        giocatore su Spotrac. Gli importi in{' '}
        <span style={{ color: '#E8C55B', fontStyle: 'italic' }}>giallo (R)</span> sono rinnovi già
        firmati in NBA ma non ancora confermati dalla lega: non contano nel cap. Clicca sulle
        intestazioni per ordinare.
      </p>
    </>
  );
}
