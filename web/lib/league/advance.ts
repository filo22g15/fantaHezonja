// Roll della finestra di 5 stagioni (equivalente a adminAvanzaStagione / avanza_stagione.py).
import type { League } from './types';

export function nextSeasonLabel(last: string) {
  const y = parseInt(String(last).slice(0, 4), 10) + 1;
  return y + '/' + String((y + 1) % 100).padStart(2, '0');
}

export interface AdvanceInfo {
  rimossa: string;
  nuova: string;
  dropYear: number;
  nuovoDraft: number;
}

// Muta il draft: scorre la finestra di un anno, elimina il draft concluso, aggiunge nuove pick.
export function advanceSeason(draft: League): AdvanceInfo {
  const S = draft.seasons;
  const rimossa = S[0];
  const dropYear = parseInt(String(rimossa).slice(0, 4), 10) + 1;
  const nuova = nextSeasonLabel(S[S.length - 1]);

  let maxY = 0;
  draft.teams.forEach((t) => (t.picks || []).forEach((pk) => { if (pk.y > maxY) maxY = pk.y; }));
  const nuovoDraft = maxY ? maxY + 1 : dropYear + 3;

  const capsArr = draft.caps && draft.caps.length ? draft.caps : draft.seasons.map(() => draft.cap || 0);

  S.shift();
  S.push(nuova);
  capsArr.shift();
  capsArr.push(capsArr[capsArr.length - 1]);
  draft.caps = capsArr;
  draft.cap = capsArr[0];

  draft.players.forEach((p) => {
    (p.sal = p.sal || [0, 0, 0, 0, 0]).shift();
    p.sal.push(0);
    (p.opt = p.opt || ['', '', '', '', '']).shift();
    p.opt.push('');
    if (p.pnd) {
      p.pnd.shift();
      p.pnd.push(0);
      if (p.pnd.every((v) => !v)) delete p.pnd;
    }
    if (p.dead && p.dead.sal) {
      p.dead.sal.shift();
      p.dead.sal.push(0);
      if (p.dead.sal.every((v) => !v)) delete p.dead;
    }
  });

  draft.teams.forEach((t) => {
    t.picks = (Array.isArray(t.picks) ? t.picks : []).filter((pk) => pk.y !== dropYear);
    for (let rd = 1; rd <= 3; rd++) t.picks.push({ y: nuovoDraft, rd, from: t.name });
  });

  return { rimossa, nuova, dropYear, nuovoDraft };
}
