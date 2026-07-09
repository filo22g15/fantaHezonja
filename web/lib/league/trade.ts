// Mosse di uno scambio, indipendenti dagli indici (per resistere ai cambi di rosa).
import type { League } from './types';

export type Move =
  | { type: 'player'; name: string; from: string; to: string }
  | { type: 'pick'; y: number; rd: number; from: string; owner: string; to: string };

// Costruisce le mosse dallo stato del builder (squadre selezionate + assegnazioni).
export function buildMoves(
  league: League,
  selected: string[],
  assign: Record<string, string>
): Move[] {
  const moves: Move[] = [];
  league.players.forEach((p, i) => {
    if (p.t && selected.includes(p.t) && p.s !== 'TAGLIATO') {
      const to = assign['p' + i];
      if (to && to !== p.t) moves.push({ type: 'player', name: p.n, from: p.t, to });
    }
  });
  selected.forEach((owner) => {
    const t = league.teams.find((x) => x.name === owner);
    (t?.picks || []).forEach((pk, idx) => {
      const to = assign['k' + owner + '#' + idx];
      if (to && to !== owner) moves.push({ type: 'pick', y: pk.y, rd: pk.rd, from: pk.from, owner, to });
    });
  });
  return moves;
}

// Applica le mosse a un draft della lega, risolvendo per nome/descrittore.
export function applyMoves(draft: League, moves: Move[]): { applied: number; skipped: number } {
  let applied = 0;
  let skipped = 0;
  for (const m of moves) {
    if (m.type === 'player') {
      const p =
        draft.players.find((x) => x.n === m.name && x.t === m.from) ||
        draft.players.find((x) => x.n === m.name);
      if (p) {
        p.t = m.to;
        applied++;
      } else skipped++;
    } else {
      const owner = draft.teams.find((x) => x.name === m.owner);
      if (!owner || !owner.picks) {
        skipped++;
        continue;
      }
      const idx = owner.picks.findIndex((pk) => pk.y === m.y && pk.rd === m.rd && pk.from === m.from);
      if (idx < 0) {
        skipped++;
        continue;
      }
      const [pick] = owner.picks.splice(idx, 1);
      const dt = draft.teams.find((x) => x.name === m.to);
      if (dt) {
        dt.picks = dt.picks || [];
        dt.picks.push(pick);
        applied++;
      } else skipped++;
    }
  }
  return { applied, skipped };
}

// Descrizione leggibile di una mossa (per la UI).
export function describeMove(m: Move): string {
  return m.type === 'player'
    ? `${m.name}: ${m.from} → ${m.to}`
    : `pick ${m.rd}° giro ${m.from} ${m.y} (${m.owner}) → ${m.to}`;
}
