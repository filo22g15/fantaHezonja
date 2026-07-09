'use client';

import Link from 'next/link';
import { useLeague, caps } from '@/lib/league/context';
import { capTotals } from '@/lib/league/cap';
import { CapBar, fmtFull } from '@/lib/league/format';
import { advanceSeason, nextSeasonLabel } from '@/lib/league/advance';

export default function RecapPage() {
  const { league, editMode, dirty, updateLeague } = useLeague();
  const S = league.seasons;
  const CAPS = caps(league);
  const CAP = CAPS[0];

  function avanzaStagione() {
    if (dirty) {
      alert('Hai modifiche non pubblicate: pubblicale o annullale prima di avanzare la stagione.');
      return;
    }
    const rimossa = S[0];
    const dropYear = parseInt(String(rimossa).slice(0, 4), 10) + 1;
    const nuova = nextSeasonLabel(S[S.length - 1]);
    let maxY = 0;
    league.teams.forEach((t) => (t.picks || []).forEach((pk) => { if (pk.y > maxY) maxY = pk.y; }));
    const nuovoDraft = maxY ? maxY + 1 : dropYear + 3;
    const ok = confirm(
      `Avanzare la lega alla stagione successiva?\n\n` +
        `• La stagione ${rimossa} viene rimossa dalla finestra dei contratti\n` +
        `• Tutti gli stipendi e le opzioni scorrono di un anno\n` +
        `• Nuova stagione vuota in coda: ${nuova}\n` +
        `• Le scelte del draft ${dropYear} vengono eliminate\n` +
        `• Ogni squadra riceve le sue 3 pick del draft ${nuovoDraft} (1°, 2°, 3° giro)\n\n` +
        `Lo storico (Bacheca / albo d'oro) NON viene toccato.\n` +
        `Dopo l'OK premi "Pubblica" in basso per salvarlo online.`
    );
    if (!ok) return;
    updateLeague((d) => advanceSeason(d));
  }

  const data = league.teams
    .map((t) => ({ t, ...capTotals(league, t.name) }))
    .sort((a, b) => CAP - b.tot[0] - (CAP - a.tot[0]));

  const capRange = CAPS.every((c) => c === CAPS[0])
    ? fmtFull(CAPS[0])
    : `${(Math.min(...CAPS) / 1e6).toFixed(0)}–${(Math.max(...CAPS) / 1e6).toFixed(0)}M`;

  return (
    <>
      <div className="eyebrow">Spazio salariale per stagione · Cap {capRange}</div>
      <h2 className="title">Recap lega</h2>

      {editMode && (
        <div className="seasonadmin">
          <button className="avanza" type="button" onClick={avanzaStagione}>
            ⏭ Avanza stagione
          </button>
          <span className="note">
            Passa alla stagione successiva: rimuove <b>{S[0]}</b> dalla finestra dei contratti, fa
            scorrere gli stipendi di un anno, elimina le scelte del draft {parseInt(S[0], 10) + 1} e
            assegna a ogni squadra le sue 3 pick del nuovo draft. Lo storico (Bacheca) resta.
          </span>
        </div>
      )}

      <div className="tablewrap tbl-cards">
        <table className="recaptab">
          <thead>
            <tr>
              <th>Squadra</th>
              {S.map((s) => (
                <th key={s} className="num">
                  {s}
                </th>
              ))}
              <th style={{ width: '26%' }}>Cap {S[0]}</th>
            </tr>
          </thead>
          <tbody>
            {data.map(({ t, tot }) => (
              <tr key={t.name}>
                <td className="pname cardtitle" data-label="Squadra">
                  <Link href={`/squadra/${encodeURIComponent(t.name)}`}>{t.name}</Link>
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
                      {(Math.abs(sp) / 1e6).toFixed(1)}M
                    </td>
                  );
                })}
                <td className="wide" data-label={`Cap ${S[0]}`}>
                  <CapBar used={tot[0]} cap={CAPS[0]} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="cardtitle">Totale lega (usato)</td>
              {S.map((_, i) => (
                <td key={i} className="num" data-label={S[i]}>
                  {(data.reduce((a, d) => a + d.tot[i], 0) / 1e6).toFixed(0)}M
                </td>
              ))}
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="legend">
        <span>
          <i style={{ background: 'var(--win)' }} />
          Spazio libero sotto il cap
        </span>
        <span>
          <i style={{ background: 'var(--loss)' }} />
          Over the cap
        </span>
        <span>
          <i style={{ background: 'var(--ball)' }} />
          Barra = cap usato (la tacca bianca è il limite)
        </span>
      </div>
    </>
  );
}
