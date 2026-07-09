'use client';

import React from 'react';
import { useLeague } from '@/lib/league/context';

type Finals = { season?: string; champion?: string; series?: string; mvp?: string };
type Conf = { season?: string; nord?: string; sud?: string };
type Div = { season?: string; nordEst?: string; nordWest?: string; centroSud?: string; sudSud?: string };
type Premio = { season?: string; mvp?: string; mip?: string; roy?: string; coy?: string };
type RecSq = { label?: string; value?: string; team?: string; season?: string };
type RecInd = { label?: string; value?: string; player?: string; match?: string; season?: string };
type Maglia = { player?: string; note?: string; season?: string };

function dash(v?: string): React.ReactNode {
  return v && String(v).trim() && v !== '-' ? v : <span className="dim">—</span>;
}

export default function BachecaPage() {
  const { bacheca } = useLeague();
  const arr = <T,>(k: string): T[] => (Array.isArray(bacheca[k]) ? (bacheca[k] as T[]) : []);
  const rev = <T,>(a: T[]) => a.slice().reverse();

  const finals = arr<Finals>('finals');
  const champs = rev(finals).filter((f) => f.champion);

  // medagliere (ricalcolato dai campioni)
  const count: Record<string, number> = {};
  finals.forEach((f) => {
    if (f.champion) count[f.champion] = (count[f.champion] || 0) + 1;
  });
  const medal = Object.keys(count)
    .map((team) => ({ team, titoli: count[team] }))
    .sort((a, b) => b.titoli - a.titoli || (a.team < b.team ? -1 : 1));

  const conference = arr<Conf>('conference');
  const division = arr<Div>('division');
  const premi = rev(arr<Premio>('premi')).filter((p) => p.mvp || p.mip || p.roy || p.coy);
  const recordSquadra = arr<RecSq>('recordSquadra');
  const recordIndividuali = arr<RecInd>('recordIndividuali');
  const maglie = arr<Maglia>('maglie');

  const vuoto =
    !champs.length &&
    !medal.length &&
    !conference.length &&
    !premi.length &&
    !recordSquadra.length &&
    !recordIndividuali.length &&
    !maglie.length;

  return (
    <>
      <div className="eyebrow">Albo d&apos;oro · premi · record della lega</div>
      <h2 className="title">Bacheca</h2>

      {vuoto ? (
        <div className="empty">
          Nessun dato in bacheca. Lancia <code>python aggiorna_bacheca.py</code> per popolarla dagli
          Excel.
        </div>
      ) : (
        <>
          {champs.length > 0 && (
            <>
              <div className="sec">Albo d&apos;oro · campioni FantaNBA</div>
              <div className="champgrid">
                {champs.map((f, i) => (
                  <div className="champcard" key={i}>
                    <div className="yr">{f.season}</div>
                    <div className="champ">🏆 {f.champion}</div>
                    {f.series && <div className="ser">{f.series}</div>}
                    {f.mvp && <div className="mvp">Finals MVP · {f.mvp}</div>}
                  </div>
                ))}
              </div>
            </>
          )}

          {medal.length > 0 && (
            <>
              <div className="sec">Medagliere · titoli FantaNBA</div>
              <div className="tablewrap">
                <table style={{ maxWidth: 520 }}>
                  <thead>
                    <tr>
                      <th className="num">#</th>
                      <th>Squadra</th>
                      <th className="num">Titoli</th>
                    </tr>
                  </thead>
                  <tbody>
                    {medal.map((m, i) => (
                      <tr key={m.team}>
                        <td className="num dim">{i + 1}</td>
                        <td className="pname">{m.team}</td>
                        <td className="num">
                          <b>{'🏆'.repeat(Math.min(m.titoli, 5))}</b> {m.titoli}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {conference.length > 0 && (
            <>
              <div className="sec">Conference winner</div>
              <div className="tablewrap">
                <table>
                  <thead>
                    <tr>
                      <th>Stagione</th>
                      <th>Nord Conference</th>
                      <th>Sud Conference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rev(conference).map((c, i) => (
                      <tr key={i}>
                        <td>{c.season}</td>
                        <td>{dash(c.nord)}</td>
                        <td>{dash(c.sud)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {division.length > 0 && (
            <>
              <div className="sec">Division winner</div>
              <div className="tablewrap">
                <table style={{ minWidth: 760 }}>
                  <thead>
                    <tr>
                      <th>Stagione</th>
                      <th>Nord Est</th>
                      <th>Nord West</th>
                      <th>Centro Sud</th>
                      <th>Sud Sud</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rev(division).map((d, i) => (
                      <tr key={i}>
                        <td>{d.season}</td>
                        <td>{dash(d.nordEst)}</td>
                        <td>{dash(d.nordWest)}</td>
                        <td>{dash(d.centroSud)}</td>
                        <td>{dash(d.sudSud)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {premi.length > 0 && (
            <>
              <div className="sec">Premi individuali</div>
              <div className="tablewrap">
                <table style={{ minWidth: 820 }}>
                  <thead>
                    <tr>
                      <th>Stagione</th>
                      <th>MVP</th>
                      <th>MIP</th>
                      <th>ROY</th>
                      <th>COY</th>
                    </tr>
                  </thead>
                  <tbody>
                    {premi.map((p, i) => (
                      <tr key={i}>
                        <td>{p.season}</td>
                        <td>{dash(p.mvp)}</td>
                        <td>{dash(p.mip)}</td>
                        <td>{dash(p.roy)}</td>
                        <td>{dash(p.coy)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {recordSquadra.length > 0 && (
            <>
              <div className="sec">Record di squadra · regular season</div>
              <div className="tablewrap">
                <table>
                  <thead>
                    <tr>
                      <th>Record</th>
                      <th className="num">Valore</th>
                      <th>Squadra</th>
                      <th>Stagione</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recordSquadra.map((r, i) => (
                      <tr key={i}>
                        <td>{r.label}</td>
                        <td className="num">
                          <b>{r.value}</b>
                        </td>
                        <td className="pname">{dash(r.team)}</td>
                        <td className="dim">{dash(r.season)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {recordIndividuali.length > 0 && (
            <>
              <div className="sec">Record individuali · regular season</div>
              <div className="reccards">
                {recordIndividuali.map((r, i) => (
                  <div className="reccard" key={i}>
                    <div className="rlab">{r.label}</div>
                    <div className="rval">{r.value}</div>
                    <div className="rwho">{r.player}</div>
                    <div className="rmeta">
                      {r.match}
                      {r.season ? ` · ${r.season}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {maglie.length > 0 && (
            <>
              <div className="sec">Maglie ritirate</div>
              <div className="reccards">
                {maglie.map((m, i) => (
                  <div className="reccard jersey" key={i}>
                    <div className="rval">👕 {m.player}</div>
                    <div className="rwho">{m.note}</div>
                    <div className="rmeta">{m.season}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          <p className="note">
            Dati condensati dagli Excel della lega (Albo d&apos;oro &amp; premi, Record, foglio
            Bacheca). Per aggiornarli: <code>python aggiorna_bacheca.py</code>.
          </p>
        </>
      )}
    </>
  );
}
