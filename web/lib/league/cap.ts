// Porting fedele della logica salary-cap da index.html (capTotals, guar, teamPlayers, deadOf).
// Regole della lega: TAGLIATO pesa per metà, solo su stagioni garantite (opzione != 'NG').
import type { League, Player } from './types';

// garantito = tutto tranne l'opzione NG (T e P contano come garantite)
export const guar = (o: string | undefined) => o !== 'NG';

export const teamPlayers = (l: League, teamName: string): Player[] =>
  l.players.filter((p) => p.t === teamName);

// giocatori il cui dead money è a carico di questa squadra (hanno rifirmato altrove)
export const deadOf = (l: League, teamName: string): Player[] =>
  l.players.filter((p) => p.dead && p.dead.t === teamName);

export interface CapTotals {
  tot: number[];
  cut: number[];
  pnd: number[];
}

// Equivalente a capTotals(name) in index.html:421
export function capTotals(l: League, teamName: string): CapTotals {
  const tot = [0, 0, 0, 0, 0];
  const cut = [0, 0, 0, 0, 0];
  const pnd = [0, 0, 0, 0, 0];

  for (const p of teamPlayers(l, teamName)) {
    const tagliato = p.s === 'TAGLIATO';
    for (let i = 0; i < 5; i++) {
      const hit = tagliato ? (guar(p.opt[i]) ? p.sal[i] / 2 : 0) : p.sal[i];
      tot[i] += hit;
      if (tagliato) cut[i] += hit;
      if (!p.sal[i] && p.pnd && p.pnd[i]) pnd[i] += p.pnd[i];
    }
  }

  for (const p of deadOf(l, teamName)) {
    for (let i = 0; i < 5; i++) {
      const hit = (p.dead!.sal[i] || 0) / 2;
      tot[i] += hit;
      cut[i] += hit;
    }
  }

  return { tot, cut, pnd };
}

export const fmtM = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}M`
    : n.toLocaleString('it-IT');
