// Helper di presentazione portati da index.html (fmtM/fmtFull/optBadge/salCell/…),
// resi come nodi React invece che stringhe HTML.
import React from 'react';
import type { Opt, Player } from './types';

export function fmtM(v: number): React.ReactNode {
  if (!v) return <span className="zero">—</span>;
  return '$' + (v / 1e6).toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + 'M';
}

export const fmtFull = (v: number) => '$' + Math.round(v).toLocaleString('it-IT');

// Versione testuale di fmtM (per contesti non-JSX: capline, big, ecc.)
export const fmtMPlain = (v: number): string =>
  v ? '$' + (v / 1e6).toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + 'M' : '—';

// Cap bar "shot clock" (equivalente a capBar in index.html)
export function CapBar({ used, cap }: { used: number; cap: number }) {
  const pct = Math.min((used / cap) * 100, 100);
  const over = used > cap;
  const tickLeft = over ? (cap / used) * 100 : 100;
  return (
    <div className="capbar" role="img" aria-label={`Cap usato ${Math.round((used / cap) * 100)}%`}>
      <div className={`fill ${over ? 'over' : ''}`} style={{ width: `${over ? 100 : pct}%` }} />
      <div className="tick" style={{ left: `${tickLeft}%` }} />
    </div>
  );
}

export function OptBadge({ o }: { o: Opt }) {
  if (!o) return null;
  const title = o === 'T' ? 'Team Option' : o === 'P' ? 'Player Option' : 'Not Guaranteed';
  return (
    <span className={`opt ${o}`} title={title}>
      {o}
    </span>
  );
}

export function Spotrac({ n }: { n: string }) {
  return (
    <a
      className="ext"
      href={`https://www.spotrac.com/search?q=${encodeURIComponent(n)}`}
      target="_blank"
      rel="noopener"
      title={`Vedi ${n} su Spotrac`}
      aria-label={`Vedi ${n} su Spotrac`}
    >
      &#8599;
    </a>
  );
}

// Cella salario (read-only): importo + opzione, oppure rinnovo giallo "R", oppure zero.
export function SalCell({ p, i }: { p: Player; i: number }) {
  const v = p.sal[i];
  if (v)
    return (
      <>
        {fmtM(v)}
        <OptBadge o={p.opt[i]} />
      </>
    );
  const r = p.pnd && p.pnd[i];
  if (r)
    return (
      <span className="pnd" title="Rinnovo firmato in NBA, non ancora confermato dalla lega">
        {fmtM(r)}
        <span className="rbadge">R</span>
      </span>
    );
  return <>{fmtM(0)}</>;
}

export const statusOf = (p: Player) => (p.t ? p.s || 'ATTIVO' : 'FREE AGENT');
export const stClass = (s: string) => (s === 'ATTIVO' ? 'attivo' : s === 'TAGLIATO' ? 'tagliato' : 'fa');
