'use client';

import Link from 'next/link';
import { useLeague, caps } from '@/lib/league/context';
import { capTotals, teamPlayers } from '@/lib/league/cap';
import { CapBar, fmtFull, fmtMPlain } from '@/lib/league/format';

export default function SquadrePage() {
  const { league, gmByTeam } = useLeague();
  const CAP = caps(league)[0];

  return (
    <>
      <div className="eyebrow">
        {league.teams.length} franchigie · Cap {fmtFull(CAP)}
      </div>
      <h2 className="title">Squadre</h2>
      <div className="grid">
        {league.teams.map((t) => {
          const { tot } = capTotals(league, t.name);
          const used = tot[0];
          const space = CAP - used;
          const n = teamPlayers(league, t.name).filter((p) => p.s !== 'TAGLIATO').length;
          return (
            <Link key={t.name} className="card" href={`/squadra/${encodeURIComponent(t.name)}`}>
              <div className="tname">{t.name}</div>
              <div className="meta">
                {gmByTeam[t.name] ? `GM ${gmByTeam[t.name]}` : ''}
                {gmByTeam[t.name] && t.city ? ' · ' : ''}
                {t.city}
                <br />
                {n} giocatori attivi
              </div>
              <CapBar used={used} cap={CAP} />
              <div className="capline">
                <span>Cap {league.seasons[0]}</span>
                <b className={space < 0 ? 'over' : 'ok'}>
                  {space < 0 ? '-' : ''}
                  {fmtMPlain(Math.abs(space))} {space < 0 ? 'over' : 'liberi'}
                </b>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
