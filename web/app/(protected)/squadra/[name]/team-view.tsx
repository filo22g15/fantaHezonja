'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLeague, caps } from '@/lib/league/context';
import { capTotals } from '@/lib/league/cap';
import { CapBar, SalCell, Spotrac, fmtM, fmtMPlain } from '@/lib/league/format';
import { PlayerName } from '../../player-modal';
import type { League, Player } from '@/lib/league/types';

interface Row {
  p: Player;
  i: number;
}

export default function TeamView({ name }: { name: string }) {
  const { league, gmByTeam, editMode, updateLeague } = useLeague();
  const S = league.seasons;
  const CAPS = caps(league);
  const [sort, setSort] = useState('0');
  const [dir, setDir] = useState(1);

  const t = league.teams.find((x) => x.name === name);
  if (!t) {
    return (
      <div className="empty">
        Squadra non trovata.{' '}
        <Link href="/squadre" style={{ color: 'var(--ball)' }}>
          Torna alle squadre
        </Link>
      </div>
    );
  }

  const withIdx: Row[] = league.players.map((p, i) => ({ p, i }));
  const salOf = (r: Row, i: number) => (r.p.sal && r.p.sal[i]) || 0;
  const deadOfSal = (r: Row, i: number) => (r.p.dead && r.p.dead.sal && r.p.dead.sal[i]) || 0;

  const sortRows = (list: Row[], getSal: (r: Row, i: number) => number) =>
    list.slice().sort((a, b) => {
      const k = sort;
      const d = dir;
      if (k === 'n' || k === 'r') {
        const va = ((a.p[k] as string) || '').toLowerCase();
        const vb = ((b.p[k] as string) || '').toLowerCase();
        return va < vb ? -d : va > vb ? d : 0;
      }
      const i = +k;
      return d * (getSal(b, i) - getSal(a, i));
    });

  const attivi = sortRows(withIdx.filter((r) => r.p.t === name && r.p.s !== 'TAGLIATO'), salOf);
  const tagliati = sortRows(withIdx.filter((r) => r.p.t === name && r.p.s === 'TAGLIATO'), salOf);
  const penali = sortRows(withIdx.filter((r) => r.p.dead && r.p.dead.t === name), deadOfSal);
  const { tot, cut, pnd } = capTotals(league, name);

  // ---- mutazioni admin ----
  const taglia = (i: number) => updateLeague((d: League) => { d.players[i].s = 'TAGLIATO'; });
  const reintegra = (i: number) => updateLeague((d: League) => { d.players[i].s = 'ATTIVO'; });
  const delPenale = (i: number) => {
    if (!confirm(`Azzerare la penale di ${league.players[i].n}?`)) return;
    updateLeague((d) => { delete d.players[i].dead; });
  };
  const pickMove = (idx: number, dest: string) => {
    if (!dest) return;
    updateLeague((d) => {
      const team = d.teams.find((x) => x.name === name)!;
      const [pick] = team.picks.splice(idx, 1);
      const dt = d.teams.find((x) => x.name === dest)!;
      dt.picks = dt.picks || [];
      dt.picks.push(pick);
    });
  };
  const pickDel = (idx: number) =>
    updateLeague((d) => {
      const team = d.teams.find((x) => x.name === name)!;
      team.picks.splice(idx, 1);
    });
  const addPick = () => {
    const y = parseInt(prompt('Anno della scelta (es. 2027):') || '', 10);
    if (!y || y < 2000 || y > 2100) return;
    const rd = parseInt(prompt('Giro (1, 2, 3…):') || '', 10);
    if (!rd || rd < 1 || rd > 15) return;
    const from = (prompt('Provenienza (squadra di origine della scelta):') || '').trim();
    if (!from) return;
    updateLeague((d) => {
      const team = d.teams.find((x) => x.name === name)!;
      team.picks = team.picks || [];
      team.picks.push({ y, rd, from });
    });
  };

  function toggleSort(k: string) {
    if (sort === k) setDir((x) => -x);
    else {
      setSort(k);
      setDir(1);
    }
  }
  const arrow = (k: string) => (sort === k ? <span className="dir">{dir === 1 ? '▾' : '▴'}</span> : null);
  const RosterHead = () => (
    <thead>
      <tr>
        <th>
          <button onClick={() => toggleSort('r')}>Ruolo {arrow('r')}</button>
        </th>
        <th>
          <button onClick={() => toggleSort('n')}>Giocatore {arrow('n')}</button>
        </th>
        {S.map((s, i) => (
          <th key={i} className="num">
            <button onClick={() => toggleSort(String(i))}>
              {s} {arrow(String(i))}
            </button>
          </th>
        ))}
        {editMode && <th />}
      </tr>
    </thead>
  );

  const RosterTable = ({ list, foot }: { list: Row[]; foot?: React.ReactNode }) => (
    <div className="tablewrap tbl-cards">
      <table>
        <RosterHead />
        <tbody>
          {list.length ? (
            list.map(({ p, i }) => (
              <tr key={i}>
                <td data-label="Ruolo">
                  <span className="role">{p.r || '—'}</span>
                </td>
                <td className="pname cardtitle" data-label="Giocatore">
                  <PlayerName n={p.n} /> <Spotrac n={p.n} url={p.spotrac} />
                </td>
                {p.sal.map((_, s) => (
                  <td key={s} className="num" data-label={S[s]}>
                    <SalCell p={p} i={s} />
                  </td>
                ))}
                {editMode && (
                  <td className="actcell">
                    {p.s === 'TAGLIATO' ? (
                      <button className="reintegra" type="button" onClick={() => reintegra(i)} title="Riporta nel roster attivo">
                        Reintegra
                      </button>
                    ) : (
                      <button className="taglia" type="button" onClick={() => taglia(i)} title="Taglia (metà cap)">
                        Taglia
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={2 + S.length + (editMode ? 1 : 0)} className="dim">
                Nessun giocatore
              </td>
            </tr>
          )}
        </tbody>
        {foot}
      </table>
    </div>
  );

  const foot = (
    <tfoot>
      <tr>
        <td colSpan={2} className="cardtitle">
          Totale cap
        </td>
        {tot.map((v, i) => (
          <td key={i} className="num" data-label={S[i]}>
            {fmtM(v)}
          </td>
        ))}
        {editMode && <td />}
      </tr>
    </tfoot>
  );

  // scelte al draft raggruppate per anno
  const pk = (t.picks || [])
    .map((p, idx) => ({ p, idx }))
    .sort((a, b) => a.p.y - b.p.y || a.p.rd - b.p.rd || (a.p.from < b.p.from ? -1 : 1));
  const anni = [...new Set(pk.map((x) => x.p.y))];
  const altreSquadre = league.teams.filter((x) => x.name !== t.name);

  return (
    <>
      <Link className="back" href="/squadre">
        ← Tutte le squadre
      </Link>
      <div className="eyebrow">{t.city || ''}</div>
      <h2 className="title">{t.name}</h2>

      <div className="facts">
        <div className="fact">
          <div className="k">General Manager</div>
          <div className="v">{gmByTeam[t.name] || '—'}</div>
        </div>
        <div className="fact">
          <div className="k">Uomo franchigia</div>
          <div className="v">{t.franchise || '—'}</div>
        </div>
        {t.nomina && (
          <div className="fact">
            <div className="k">Nomina</div>
            <div className="v">
              {t.nomina} → {t.scadenza || '?'}
            </div>
          </div>
        )}
        <div className="fact">
          <div className="k">Roster attivo</div>
          <div className="v">{attivi.length} giocatori</div>
        </div>
      </div>

      <div className="capgrid">
        {S.map((s, i) => {
          const space = CAPS[i] - tot[i];
          return (
            <div className="capcell" key={i}>
              <div className="season">{s}</div>
              <CapBar used={tot[i]} cap={CAPS[i]} />
              <div className="big" style={{ color: space < 0 ? 'var(--loss)' : 'var(--win)' }}>
                {space < 0 ? '−' : ''}
                {fmtMPlain(Math.abs(space))}
              </div>
              <div className="sub">
                usati <b>{(tot[i] / 1e6).toFixed(1)}M</b>
                {cut[i] ? (
                  <>
                    {' · dead money '}
                    <b style={{ color: 'var(--loss)' }}>{(cut[i] / 1e6).toFixed(1)}M</b>
                  </>
                ) : null}
                {pnd[i] ? (
                  <>
                    {' · rinnovi da confermare '}
                    <b style={{ color: '#E8C55B' }}>+{(pnd[i] / 1e6).toFixed(1)}M</b>
                  </>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <div className="sec">Roster attivo</div>
      <RosterTable list={attivi} foot={foot} />

      {tagliati.length > 0 && (
        <>
          <div className="sec">Tagliati (dead money)</div>
          <RosterTable list={tagliati} />
          <p className="note">
            I giocatori tagliati pesano sul salary cap per <b>metà</b> del loro contratto, solo sulle
            stagioni garantite (le stagioni <b>NG</b> non pesano).
          </p>
        </>
      )}

      {penali.length > 0 && (
        <>
          <div className="sec">Penali da tagli (rifirmati altrove)</div>
          <div className="tablewrap tbl-cards">
            <table>
              <RosterHead />
              <tbody>
                {penali.map(({ p, i }) => (
                  <tr key={i}>
                    <td data-label="Ruolo">
                      <span className="role">{p.r || '—'}</span>
                    </td>
                    <td className="pname cardtitle" data-label="Giocatore">
                      <PlayerName n={p.n} /> <Spotrac n={p.n} url={p.spotrac} /> <span className="dim">→ {p.t ? p.t : 'svincolato'}</span>
                    </td>
                    {p.dead!.sal.map((v, s) => (
                      <td key={s} className="num" data-label={S[s]}>
                        {fmtM(v)}
                      </td>
                    ))}
                    {editMode && (
                      <td className="actcell">
                        <button className="taglia" type="button" onClick={() => delPenale(i)} title="Azzera penale">
                          ✕
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="note">
            Giocatori tagliati da questa squadra e poi rifirmati da un&apos;altra: la penale (metà dello
            stipendio garantito residuo) resta a carico di questa squadra. Si modifica dalla pagina{' '}
            <Link href="/" style={{ color: 'var(--ball)' }}>
              Contratti
            </Link>
            .
          </p>
        </>
      )}

      <div className="sec">Scelte al draft</div>
      {pk.length ? (
        <div className="picks">
          {anni.map((y) => (
            <div className="pickcol" key={y}>
              <div className="yr">{y}</div>
              <ul>
                {pk
                  .filter((x) => x.p.y === y)
                  .map(({ p, idx }) => (
                    <li key={idx}>
                      <span className="rd">{p.rd}° giro</span>
                      <span className="from">{p.from}</span>
                      {editMode && (
                        <span className="pickctl">
                          <select
                            className="pickmove"
                            defaultValue=""
                            onChange={(e) => pickMove(idx, e.target.value)}
                            title="Sposta a un'altra squadra"
                          >
                            <option value="">↔</option>
                            {altreSquadre.map((x) => (
                              <option key={x.name} value={x.name}>
                                → {x.name}
                              </option>
                            ))}
                          </select>
                          <button className="pickdel" type="button" onClick={() => pickDel(idx)} title="Rimuovi scelta">
                            ✕
                          </button>
                        </span>
                      )}
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <p className="note">Nessuna scelta futura registrata per questa squadra.</p>
      )}
      {editMode && (
        <button className="addpick" type="button" onClick={addPick}>
          + Aggiungi scelta
        </button>
      )}

      <div className="sec">Cap rimanente</div>
      <div className="tablewrap tbl-cards">
        <table>
          <thead>
            <tr>
              <th>Salary cap</th>
              {S.map((s) => (
                <th key={s} className="num">
                  {s}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="dim cardtitle">Cap totale</td>
              {CAPS.map((c, i) => (
                <td key={i} className="num dim" data-label={S[i]}>
                  {fmtM(c)}
                </td>
              ))}
            </tr>
            <tr>
              <td className="cardtitle">Utilizzato</td>
              {tot.map((v, i) => (
                <td key={i} className="num" data-label={S[i]}>
                  {fmtM(v)}
                </td>
              ))}
            </tr>
            <tr>
              <td className="cardtitle">
                <b>Rimanente</b>
              </td>
              {tot.map((v, i) => {
                const sp = CAPS[i] - v;
                return (
                  <td
                    key={i}
                    className="num"
                    data-label={S[i]}
                    style={{ color: sp < 0 ? 'var(--loss)' : sp > 0 ? 'var(--win)' : 'var(--muted)' }}
                  >
                    {sp < 0 ? '−' : ''}
                    {fmtMPlain(Math.abs(sp))}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
