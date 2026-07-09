// Scraping lato server — port Node di sincronizza.py: ruolo da sports.ws,
// contratti da Spotrac. L'anti-bot blocca per IP: su Vercel (IP datacenter) può
// fallire più spesso che da casa. Importato SOLO dalla route /api/sync-player (server).

const UA = 'Mozilla/5.0 (lega FantaNBA privata - sync dati)';
const RUOLI = new Set(['G', 'GF', 'F', 'FC', 'C']);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function pulisci(nome: string) {
  return nome
    .normalize('NFKD')
    .replace(/[^\x00-\x7F]/g, '')
    .replace(/['.]/g, '');
}
function slug(nome: string) {
  return pulisci(nome)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
const senzaTag = (html: string) => html.replace(/<[^>]+>/g, ' ');

class Bloccato extends Error {}

// GET con rilevamento blocco anti-bot e un paio di tentativi (breve, per stare nel timeout serverless).
async function richiesta(url: string): Promise<Response> {
  let attesa = 1200;
  let r: Response | null = null;
  for (let tent = 0; tent < 3; tent++) {
    r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
    const text = r.status === 200 ? await r.clone().text() : '';
    const bloccato = [202, 403, 429].includes(r.status) || (r.status === 200 && !text.trim());
    if (!bloccato) return r;
    if (tent < 2) {
      await sleep(attesa);
      attesa *= 2;
    }
  }
  throw new Bloccato(`HTTP ${r?.status ?? '?'} da ${url}`);
}

async function ruoloSportsws(nome: string): Promise<string | null> {
  try {
    const r = await richiesta(`https://sports.ws/nba/${slug(nome)}`);
    if (r.status !== 200) return null;
    const m = senzaTag(await r.text()).match(/Position:\s*([A-Z]{1,2})\b/);
    if (m && RUOLI.has(m[1])) return m[1];
  } catch {
    /* ignore */
  }
  return null;
}

export async function urlSpotrac(nome: string): Promise<string | null> {
  try {
    const r = await richiesta(`https://www.spotrac.com/search?q=${encodeURIComponent(pulisci(nome))}`);
    if (r.status !== 200) return null;
    if (/\/nba\/player\/_\/id\/\d+/.test(r.url)) return r.url.split('?')[0];
    const html = await r.text();
    const atteso = pulisci(nome).toLowerCase();
    let primoNba: string | null = null;
    const re = /href="[^"]*redirect\/player\/(\d+)[^"]*"([\s\S]*?)<\/a>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html))) {
      const [, pid, body] = m;
      if (!body.includes('nba_')) continue;
      const url = `https://www.spotrac.com/redirect/player/${pid}`;
      primoNba = primoNba || url;
      const nm = body.match(/<span[^>]*>([^<]+)<\/span>/);
      if (nm && pulisci(nm[1]).toLowerCase() === atteso) return url;
    }
    return primoNba;
  } catch {
    return null;
  }
}

// Ritorna { stagione(Spotrac): cap_hit } dato l'URL del profilo.
async function caphitFromUrl(url: string, stagioni: string[]): Promise<Record<string, number> | null> {
  try {
    const r = await richiesta(url);
    if (r.status !== 200) return null;
    const html = await r.text();
    const trovati: Record<string, number> = {};
    for (const riga of html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || []) {
      const testo = senzaTag(riga);
      const stag = stagioni.find((s) => testo.includes(s));
      if (!stag || stag in trovati) continue;
      const importi = (testo.match(/\$([\d,]{7,})/g) || [])
        .map((x) => parseInt(x.replace(/[$,]/g, ''), 10))
        .filter((x) => x >= 1_000_000 && x <= 100_000_000);
      if (importi.length) {
        // valore più frequente nella riga (base salary e cap hit di norma coincidono)
        const freq: Record<number, number> = {};
        importi.forEach((v) => (freq[v] = (freq[v] || 0) + 1));
        trovati[stag] = Number(Object.keys(freq).sort((a, b) => freq[+b] - freq[+a])[0]);
      }
    }
    return Object.keys(trovati).length ? trovati : null;
  } catch {
    return null;
  }
}

// ── Statistiche fantasy da sports.ws (pagina pubblica /nba/<slug>) ──────────────
// Usato dalla route /api/player-stats per il popup statistiche giocatore.

// Punteggio CUSTOM della lega (FantaNBA Hezonja). I valori FP/FPPM della pagina
// sports.ws usano il punteggio standard del sito: qui li RICALCOLIAMO dal tabellino
// grezzo con questi pesi. Per cambiare le regole basta modificare questa costante.
export const SCORING = {
  ftm: 2.0, // tiri liberi segnati
  fta: -1.0, // tiri liberi tentati
  p2m: 3.0, // canestri da 2 segnati
  p2a: -1.0, // tiri da 2 tentati
  p3m: 4.0, // canestri da 3 segnati
  p3a: -1.0, // tiri da 3 tentati
  orb: 1.0, // rimbalzi offensivi
  drb: 1.0, // rimbalzi difensivi
  ast: 1.0, // assist
  blk: 1.3, // stoppate
  stl: 1.5, // palle rubate
  to: -1.0, // palle perse
};

export interface PlayerStatLine {
  gp: number; // partite giocate (min > 0) nella finestra
  fppg: number | null; // fantasy points per game (media, punteggio lega)
  fppm: number | null; // fantasy points per minute (punteggio lega)
}
export interface PlayerGame {
  date: string; // YYYY-MM-DD
  opp: string | null; // es. "ORL @ BOS"
  min: number | null;
  pts: number | null;
  reb: number | null;
  ast: number | null;
  blk: number | null;
  stl: number | null;
  to: number | null;
  fp: number | null; // fantasy points CUSTOM di questa partita
  fppm: number | null; // fp / minuti
}
export interface PlayerStats {
  found: boolean;
  name: string;
  slug: string;
  url: string; // link alla pagina sports.ws
  season: string | null; // es. "2025-26"
  scoring: 'custom'; // i punteggi sono ricalcolati con la formula della lega
  header: {
    team: string | null; // sigla squadra (es. "BOS")
    pos: string | null;
    height: string | null;
    weight: string | null;
    age: string | null;
    photo: string | null; // URL assoluto headshot
  };
  // FPPM/FPPG (punteggio lega) per finestra temporale
  season_line: PlayerStatLine;
  last5: PlayerStatLine;
  last10: PlayerStatLine;
  last20: PlayerStatLine;
  monthly: { month: string; gp: number; fppg: number | null; fppm: number | null }[];
  gamelog: PlayerGame[]; // ordine cronologico inverso (più recente prima)
}

const SPORTSWS = 'https://sports.ws';
const toNum = (s: string | undefined): number | null => {
  if (s == null) return null;
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : null;
};
const numeri = (s: string): string[] => s.match(/-?\d+\.?\d*/g) || [];
const r2 = (v: number) => Math.round(v * 100) / 100;

const MESI_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Tabellino secondario di una partita (dal blocco "more-game-log").
interface SecLine {
  fgm: number; fga: number; tpm: number; tpa: number;
  ftm: number; fta: number; orb: number; drb: number; to: number;
}

// FP con la formula custom della lega, dai dati grezzi primari + secondari.
function fpCustom(p: PlayerGame, s: SecLine): number {
  const p2m = s.fgm - s.tpm; // canestri da 2 = FG totali − da 3
  const p2a = s.fga - s.tpa;
  return (
    SCORING.ftm * s.ftm + SCORING.fta * s.fta +
    SCORING.p2m * p2m + SCORING.p2a * p2a +
    SCORING.p3m * s.tpm + SCORING.p3a * s.tpa +
    SCORING.orb * s.orb + SCORING.drb * s.drb +
    SCORING.ast * (p.ast ?? 0) + SCORING.blk * (p.blk ?? 0) + SCORING.stl * (p.stl ?? 0) +
    SCORING.to * s.to
  );
}

// Aggrega una lista di partite in FPPG/FPPM (solo partite giocate, min > 0).
function aggrega(games: PlayerGame[]): PlayerStatLine {
  const giocate = games.filter((g) => (g.min ?? 0) > 0 && g.fp !== null);
  if (!giocate.length) return { gp: 0, fppg: null, fppm: null };
  const totFp = giocate.reduce((a, g) => a + (g.fp as number), 0);
  const totMin = giocate.reduce((a, g) => a + (g.min as number), 0);
  return {
    gp: giocate.length,
    fppg: r2(totFp / giocate.length),
    fppm: totMin > 0 ? Math.round((totFp / totMin) * 1000) / 1000 : null,
  };
}

// Estrae le righe del tabellino secondario (FGs, 3Ps, FTs, OR/DR, TO), stesso
// ordine cronologico inverso del primario → si allineano per indice.
function tabellinoSecondario(html: string): SecLine[] {
  const start = html.indexOf('more-game-log');
  if (start < 0) return [];
  const end = html.indexOf('Career Stats', start);
  const block = html.slice(start, end > 0 ? end : undefined);
  // via il doppione desktop-hide, poi spezzo sulle date (una per riga)
  const clean = block.replace(/<span class="desktop-hide[^"]*">[\s\S]*?<\/span>/g, '');
  const rows = clean.split(/<span class="mobile-hide">&nbsp;[A-Z][a-z]{2}\. \d+<\/span>/);
  const out: SecLine[] = [];
  const re =
    /(\d+)-(\d+)\s+[\d.]+\s+(\d+)-(\d+)\s+[\d.]+\s+(\d+)-(\d+)\s+[\d.]+\s+(\d+)\s*\/\s*(\d+)\s+(\d+)/;
  for (let i = 1; i < rows.length; i++) {
    const m = senzaTag(rows[i]).match(re);
    if (!m) { out.push({ fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, orb: 0, drb: 0, to: 0 }); continue; }
    const [, fgm, fga, tpm, tpa, ftm, fta, orb, drb, to] = m.map(Number);
    out.push({ fgm, fga, tpm, tpa, ftm, fta, orb, drb, to });
  }
  return out;
}

export async function playerStats(nome: string): Promise<PlayerStats> {
  const sl = slug(nome);
  const url = `${SPORTSWS}/nba/${sl}`;
  const zero: PlayerStatLine = { gp: 0, fppg: null, fppm: null };
  const vuoto: PlayerStats = {
    found: false,
    name: nome,
    slug: sl,
    url,
    season: null,
    scoring: 'custom',
    header: { team: null, pos: null, height: null, weight: null, age: null, photo: null },
    season_line: zero,
    last5: zero,
    last10: zero,
    last20: zero,
    monthly: [],
    gamelog: [],
  };

  const r = await richiesta(url); // può sollevare Bloccato (gestito dalla route)
  if (r.status !== 200) return vuoto;
  const html = await r.text();
  // Se la pagina non contiene la sezione riepilogo, lo slug non ha trovato il giocatore.
  if (!/Summary/.test(html)) return vuoto;

  // Header
  const season = html.match(/&nbsp;(\d{4}-\d{2})\s+Summary/)?.[1] ?? null;
  const photoRel = html.match(/\/img\/headshots\/png\/[\w-]+\.png/)?.[0] ?? null;
  const header = {
    team: html.match(/\/headshots\/jerseys\/(\w+)\.png/)?.[1] ?? null,
    pos: html.match(/Position:\s*<strong>([A-Z]{1,2})/)?.[1] ?? null,
    height: html.match(/Height:\s*<strong>([^<]+)/)?.[1]?.trim() ?? null,
    weight: html.match(/Weight:\s*<strong>([^<]+)/)?.[1]?.trim() ?? null,
    age: html.match(/Age:\s*<strong>([^<]+)/)?.[1]?.trim() ?? null,
    photo: photoRel ? SPORTSWS + photoRel : null,
  };

  // Game log primario (min/pts/reb/ast/blk/stl), ordine cronologico inverso.
  const gamelog: PlayerGame[] = [];
  const glStart = html.indexOf('basic-game-log');
  if (glStart >= 0) {
    const glEnd = html.indexOf('Career Stats', glStart);
    const block = html.slice(glStart, glEnd > 0 ? glEnd : undefined);
    const parts = block.split(/<a href="\/nba\/(\d{4}-\d{2}-\d{2})\/[^"]*"/);
    for (let i = 1; i < parts.length; i += 2) {
      const date = parts[i];
      const body = parts[i + 1] || '';
      const chiuso = body.indexOf('</a>');
      let opp: string | null = null;
      if (chiuso >= 0) {
        const raw = body.slice(0, chiuso);
        const gt = raw.indexOf('>'); // fine del tag <a ...>
        const inner = (gt >= 0 ? raw.slice(gt + 1) : raw).replace(
          /<span class="desktop-hide[^"]*">[\s\S]*?<\/span>/g,
          ''
        );
        opp = senzaTag(inner).replace(/\s+/g, ' ').trim() || null;
      }
      const dopo = chiuso >= 0 ? body.slice(chiuso + 4) : body;
      const v = numeri(senzaTag(dopo)).slice(0, 6); // MIN PTS REB AST BLK STL (ignoro FP/FPPM standard)
      if (v.length >= 6) {
        gamelog.push({
          date, opp,
          min: toNum(v[0]), pts: toNum(v[1]), reb: toNum(v[2]),
          ast: toNum(v[3]), blk: toNum(v[4]), stl: toNum(v[5]),
          to: null, fp: null, fppm: null,
        });
      }
    }
  }

  // Tabellino secondario → calcolo FP custom per partita (allineo per indice).
  const sec = tabellinoSecondario(html);
  if (sec.length === gamelog.length) {
    for (let i = 0; i < gamelog.length; i++) {
      const g = gamelog[i];
      const s = sec[i];
      g.to = s.to;
      g.fp = r2(fpCustom(g, s));
      g.fppm = (g.min ?? 0) > 0 ? Math.round((g.fp / (g.min as number)) * 1000) / 1000 : null;
    }
  }

  // Riepiloghi per finestra, ricalcolati dai FP custom (partite giocate).
  const giocate = gamelog.filter((g) => (g.min ?? 0) > 0 && g.fp !== null);
  const season_line = aggrega(gamelog);
  const last5 = aggrega(giocate.slice(0, 5));
  const last10 = aggrega(giocate.slice(0, 10));
  const last20 = aggrega(giocate.slice(0, 20));

  // Split mensili (per mese di calendario dalla data), in ordine cronologico.
  const perMese = new Map<string, PlayerGame[]>();
  for (const g of gamelog) {
    const key = g.date.slice(0, 7); // "2025-10"
    (perMese.get(key) ?? perMese.set(key, []).get(key)!).push(g);
  }
  const monthly = [...perMese.keys()]
    .sort()
    .map((key) => {
      const line = aggrega(perMese.get(key)!);
      const mese = MESI_ABBR[parseInt(key.slice(5, 7), 10) - 1] ?? key;
      return { month: mese, gp: line.gp, fppg: line.fppg, fppm: line.fppm };
    })
    .filter((m) => m.gp > 0);

  const found = gamelog.length > 0 || header.pos !== null;
  return {
    ...vuoto, found, season, header,
    season_line, last5, last10, last20, monthly, gamelog,
  };
}

export interface SyncResult {
  role: string | null;
  // cap hit per indice di stagione (allineato a league.seasons), null se non trovato
  sal: (number | null)[];
  spotracUrl: string | null; // URL diretto del profilo NBA (per il link ↗)
  found: boolean;
}

// stagioni = league.seasons (es. ["2025/26",...]); le converto al formato Spotrac ("2025-26").
export async function syncPlayer(nome: string, stagioni: string[]): Promise<SyncResult> {
  const spotracSeasons = stagioni.map((s) => s.replace('/', '-'));
  const [role, url] = await Promise.all([ruoloSportsws(nome), urlSpotrac(nome)]);
  const caphits = url ? await caphitFromUrl(url, spotracSeasons) : null;
  const sal = spotracSeasons.map((s) => (caphits && caphits[s]) || null);
  return {
    role,
    sal,
    spotracUrl: url,
    found: role !== null || sal.some((v) => v !== null) || !!url,
  };
}
