'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLeague, caps } from '@/lib/league/context';
import { capTotals } from '@/lib/league/cap';
import { fmtMPlain } from '@/lib/league/format';
import { applyMoves, buildMoves, describeMove, type Move } from '@/lib/league/trade';
import { applyProposal, proposeTrade, rejectProposal } from '@/app/actions/tradeProposals';
import type { League } from '@/lib/league/types';

export interface Proposal {
  id: number;
  created_at: string;
  proposer: string | null;
  teams: string[];
  moves: Move[];
  note: string | null;
  status: 'pending' | 'accepted' | 'rejected';
}

const statusColor = (s: string) =>
  s === 'accepted' ? 'var(--win)' : s === 'rejected' ? 'var(--loss)' : '#E8C55B';

export default function TradeView({
  isAdmin,
  myTeam,
  proposals,
}: {
  isAdmin: boolean;
  myTeam: string | null;
  proposals: Proposal[];
}) {
  const { league, updateLeague } = useLeague();
  const router = useRouter();
  const CAP = caps(league)[0];
  // I membri partono con la propria squadra già in campo.
  const [slots, setSlots] = useState<string[]>(!isAdmin && myTeam ? [myTeam, ''] : ['', '']);
  const [assign, setAssign] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const teams = league.teams.map((t) => t.name).sort();
  const selected = slots.filter(Boolean);

  const playersIdx = league.players.map((p, i) => ({ p, i }));
  const tradePlayers = (name: string) => playersIdx.filter(({ p }) => p.t === name && p.s !== 'TAGLIATO');
  const tradePicksOf = (name: string) => {
    const t = league.teams.find((x) => x.name === name);
    return ((t && t.picks) || []).map((p, idx) => ({ p, idx }));
  };

  const pruneAssign = (nextSlots: string[]) => {
    const sel = nextSlots.filter(Boolean);
    const ids = new Set<string>();
    sel.forEach((name) => {
      tradePlayers(name).forEach(({ i }) => ids.add('p' + i));
      tradePicksOf(name).forEach(({ idx }) => ids.add('k' + name + '#' + idx));
    });
    setAssign((prev) => {
      const next: Record<string, string> = {};
      Object.keys(prev).forEach((id) => {
        if (ids.has(id) && sel.includes(prev[id])) next[id] = prev[id];
      });
      return next;
    });
  };
  const setSlot = (i: number, value: string) => {
    const next = [...slots];
    next[i] = value;
    setSlots(next);
    pruneAssign(next);
  };
  const setDest = (id: string, value: string) =>
    setAssign((prev) => {
      const next = { ...prev };
      if (value) next[id] = value;
      else delete next[id];
      return next;
    });

  const receives = (name: string) => {
    const out: { t: 'p' | 'k'; label: string }[] = [];
    selected.forEach((owner) => {
      if (owner === name) return;
      tradePlayers(owner).forEach(({ p, i }) => {
        if (assign['p' + i] === name) out.push({ t: 'p', label: p.n });
      });
      tradePicksOf(owner).forEach(({ p, idx }) => {
        if (assign['k' + owner + '#' + idx] === name)
          out.push({ t: 'k', label: `${p.rd}° giro ${p.from} ${p.y}` });
      });
    });
    return out;
  };
  const projUsed = (name: string) => {
    let used = capTotals(league, name).tot[0];
    league.players.forEach((p, i) => {
      if (p.s === 'TAGLIATO') return;
      const d = assign['p' + i];
      if (p.t === name && d && d !== name) used -= p.sal[0];
      if (d === name && p.t && p.t !== name) used += p.sal[0];
    });
    return used;
  };

  const DestSel = ({ assetId, owner }: { assetId: string; owner: string }) => {
    const cur = assign[assetId] || '';
    return (
      <select className={`adest ${cur ? 'set' : ''}`} value={cur} onChange={(e) => setDest(assetId, e.target.value)}>
        <option value="">resta</option>
        {selected
          .filter((n) => n !== owner)
          .map((n) => (
            <option key={n} value={n}>
              → {n}
            </option>
          ))}
      </select>
    );
  };

  const nAssign = Object.values(assign).filter(Boolean).length;

  // Admin: applica direttamente (poi Pubblica dalla barra)
  function applyDirect() {
    const moves = buildMoves(league, selected, assign);
    if (!moves.length) {
      alert('Non hai impostato nessuno spostamento.');
      return;
    }
    if (!confirm(`Applicare ${moves.length} spostament${moves.length === 1 ? 'o' : 'i'}? Poi premi Pubblica.`)) return;
    updateLeague((d: League) => applyMoves(d, moves));
    setAssign({});
    alert('Scambio applicato. Premi "Pubblica" in basso per salvarlo online.');
  }

  // Membro: propone
  async function propose() {
    if (myTeam && !selected.includes(myTeam)) {
      alert(`Puoi proporre scambi solo se la tua squadra (${myTeam}) è coinvolta.`);
      return;
    }
    const moves = buildMoves(league, selected, assign);
    if (!moves.length) {
      alert('Imposta almeno uno spostamento.');
      return;
    }
    setBusy(true);
    const res = await proposeTrade(selected, moves, note);
    setBusy(false);
    if (res.ok) {
      alert("Proposta inviata all'admin.");
      setAssign({});
      setNote('');
      router.refresh();
    } else alert('Errore: ' + res.error);
  }

  async function accept(id: number) {
    if (!confirm('Accettare e applicare questo scambio? Verrà pubblicato subito.')) return;
    setBusy(true);
    const res = await applyProposal(id);
    setBusy(false);
    if (res.ok) {
      alert('Scambio applicato.' + (res.info ? '\n' + res.info : ''));
      window.location.reload();
    } else alert('Errore: ' + res.error);
  }
  async function reject(id: number) {
    if (!confirm('Rifiutare questa proposta?')) return;
    setBusy(true);
    const res = await rejectProposal(id);
    setBusy(false);
    if (res.ok) router.refresh();
    else alert('Errore: ' + res.error);
  }

  return (
    <>
      <div className="eyebrow">
        {isAdmin ? 'Admin · applica direttamente o gestisci le proposte' : 'Proponi uno scambio all’admin'}
      </div>
      <h2 className="title">{isAdmin ? 'Scambi' : 'Proponi scambio'}</h2>

      {/* Pannello proposte */}
      {isAdmin && proposals.length > 0 && (
        <>
          <div className="sec">Proposte in sospeso</div>
          {proposals.map((pr) => (
            <div className="seasonadmin" key={pr.id} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              <div>
                <b>{pr.proposer || 'Qualcuno'}</b> · {pr.teams.join(' ↔ ')}{' '}
                <span className="dim">({new Date(pr.created_at).toLocaleString('it-IT')})</span>
              </div>
              <ul style={{ margin: '6px 0', paddingLeft: 18 }}>
                {pr.moves.map((m, k) => (
                  <li key={k}>{describeMove(m)}</li>
                ))}
              </ul>
              {pr.note && <div className="note" style={{ margin: 0 }}>“{pr.note}”</div>}
              <div className="tradebar" style={{ marginTop: 8 }}>
                <button className="apply" type="button" disabled={busy} onClick={() => accept(pr.id)}>
                  Accetta e applica
                </button>
                <button className="reset" type="button" disabled={busy} onClick={() => reject(pr.id)}>
                  Rifiuta
                </button>
              </div>
            </div>
          ))}
        </>
      )}

      {/* Le proprie proposte (membro) */}
      {!isAdmin && proposals.length > 0 && (
        <>
          <div className="sec">Le tue proposte</div>
          {proposals.map((pr) => (
            <div className="seasonadmin" key={pr.id} style={{ flexDirection: 'column', alignItems: 'stretch', borderColor: statusColor(pr.status) }}>
              <div>
                {pr.teams.join(' ↔ ')} ·{' '}
                <b style={{ color: statusColor(pr.status) }}>
                  {pr.status === 'pending' ? 'in attesa' : pr.status === 'accepted' ? 'accettata' : 'rifiutata'}
                </b>{' '}
                <span className="dim">({new Date(pr.created_at).toLocaleString('it-IT')})</span>
              </div>
              <ul style={{ margin: '6px 0', paddingLeft: 18 }}>
                {pr.moves.map((m, k) => (
                  <li key={k}>{describeMove(m)}</li>
                ))}
              </ul>
            </div>
          ))}
        </>
      )}

      <div className="sec">Costruttore</div>
      <div className="tradeslots">
        {slots.map((s, i) => (
          <select key={i} className="tslot" value={s} onChange={(e) => setSlot(i, e.target.value)} aria-label={`Squadra ${i + 1}`}>
            <option value="">— squadra {i + 1} —</option>
            {teams.map((n) => (
              <option key={n} value={n} disabled={selected.includes(n) && s !== n}>
                {n}
              </option>
            ))}
          </select>
        ))}
        {slots.length < 4 && (
          <button className="addslot" type="button" onClick={() => setSlots([...slots, ''])}>
            + Squadra
          </button>
        )}
      </div>

      {selected.length < 2 ? (
        <div className="empty">Scegli almeno due squadre per iniziare lo scambio.</div>
      ) : (
        <>
          <div className="trade">
            {selected.map((name) => {
              const gp = tradePlayers(name);
              const gk = tradePicksOf(name);
              const recv = receives(name);
              const used = projUsed(name);
              const space = CAP - used;
              return (
                <div className="tcol" key={name}>
                  <h3>{name}</h3>
                  <div className="pcap">
                    Cap {league.seasons[0]} proiettato{' '}
                    <b style={{ color: space < 0 ? 'var(--loss)' : 'var(--win)' }}>{(used / 1e6).toFixed(1)}M</b> · spazio{' '}
                    <b style={{ color: space < 0 ? 'var(--loss)' : 'var(--win)' }}>
                      {space < 0 ? '−' : ''}
                      {(Math.abs(space) / 1e6).toFixed(1)}M
                    </b>
                  </div>
                  <div className="tgroup">
                    <div className="lab">Cede · giocatori</div>
                    {gp.length ? (
                      gp.map(({ p, i }) => (
                        <div className="asset" key={i}>
                          <span className="aname">
                            {p.n}
                            <span className="as">{fmtMPlain(p.sal[0])}</span>
                          </span>
                          <DestSel assetId={'p' + i} owner={name} />
                        </div>
                      ))
                    ) : (
                      <div className="recv">
                        <span className="none">nessun giocatore</span>
                      </div>
                    )}
                  </div>
                  <div className="tgroup">
                    <div className="lab">Cede · scelte</div>
                    {gk.length ? (
                      gk.map(({ p, idx }) => (
                        <div className="asset" key={idx}>
                          <span className="aname apick">
                            {p.rd}° giro <span className="as">{p.from} {p.y}</span>
                          </span>
                          <DestSel assetId={'k' + name + '#' + idx} owner={name} />
                        </div>
                      ))
                    ) : (
                      <div className="recv">
                        <span className="none">nessuna scelta</span>
                      </div>
                    )}
                  </div>
                  <div className="tgroup">
                    <div className="lab">Riceve</div>
                    <div className="recv">
                      {recv.length ? (
                        recv.map((r, k) => (
                          <div className={`ri ${r.t === 'k' ? 'pick' : ''}`} key={k}>
                            {r.t === 'k' ? '◆' : '+'} {r.label}
                          </div>
                        ))
                      ) : (
                        <span className="none">niente, per ora</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {!isAdmin && (
            <input
              type="text"
              placeholder="Nota per l'admin (opzionale)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={{
                marginTop: 16,
                width: '100%',
                background: 'var(--panel)',
                border: '1px solid var(--line)',
                color: 'var(--ink)',
                borderRadius: 8,
                padding: '9px 12px',
              }}
            />
          )}

          <div className="tradebar">
            {isAdmin ? (
              <button className="apply" type="button" onClick={applyDirect} disabled={!nAssign}>
                Applica scambio{nAssign ? ` (${nAssign})` : ''}
              </button>
            ) : (
              <button className="apply" type="button" onClick={propose} disabled={!nAssign || busy}>
                {busy ? 'Invio…' : `Proponi scambio${nAssign ? ` (${nAssign})` : ''}`}
              </button>
            )}
            <button className="reset" type="button" onClick={() => setAssign({})}>
              Azzera
            </button>
          </div>
        </>
      )}

      <p className="note">
        {isAdmin
          ? 'Per ogni squadra scegli dove vanno giocatori e scelte. “Applica scambio” esegue subito (poi Pubblica). Le proposte dei membri appaiono qui sopra: Accetta le applica e pubblica, Rifiuta le scarta.'
          : 'Per ogni squadra scegli dove vanno giocatori e scelte (menu “→ squadra”). “Proponi scambio” invia la richiesta all’admin, che potrà accettarla o rifiutarla.'}
      </p>
    </>
  );
}
