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

export interface PlayerStatLine {
  fppg: number | null;
  fppm: number | null;
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
  fp: number | null;
  fppm: number | null;
}
export interface PlayerStats {
  found: boolean;
  name: string;
  slug: string;
  url: string; // link alla pagina sports.ws
  season: string | null; // es. "2025-26"
  header: {
    team: string | null; // sigla squadra (es. "BOS")
    pos: string | null;
    height: string | null;
    weight: string | null;
    age: string | null;
    photo: string | null; // URL assoluto headshot
  };
  // FPPM/FPPG per finestra temporale
  season_line: PlayerStatLine;
  last5: PlayerStatLine;
  last10: PlayerStatLine;
  last20: PlayerStatLine;
  monthly: { month: string; fppg: number | null; fppm: number | null }[];
  gamelog: PlayerGame[]; // ordine cronologico inverso (più recente prima)
}

const SPORTSWS = 'https://sports.ws';
const toNum = (s: string | undefined): number | null => {
  if (s == null) return null;
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : null;
};
const numeri = (s: string): string[] => s.match(/-?\d+\.?\d*/g) || [];

// Estrae FPPG (8° valore) e FPPM (9° valore) da un blocco riepilogo (quickseason/…).
function lineaSommario(html: string, cls: string): PlayerStatLine {
  const re = new RegExp(`class="${cls}"([\\s\\S]*?)(?:class="quick|2025-26 Game Log|Game Log)`);
  const m = html.match(re);
  if (!m) return { fppg: null, fppm: null };
  const dopo = senzaTag(m[1]).split('FPPM')[1] || '';
  const v = numeri(dopo).slice(0, 9);
  return v.length >= 9 ? { fppg: toNum(v[7]), fppm: toNum(v[8]) } : { fppg: null, fppm: null };
}

export async function playerStats(nome: string): Promise<PlayerStats> {
  const sl = slug(nome);
  const url = `${SPORTSWS}/nba/${sl}`;
  const vuoto: PlayerStats = {
    found: false,
    name: nome,
    slug: sl,
    url,
    season: null,
    header: { team: null, pos: null, height: null, weight: null, age: null, photo: null },
    season_line: { fppg: null, fppm: null },
    last5: { fppg: null, fppm: null },
    last10: { fppg: null, fppm: null },
    last20: { fppg: null, fppm: null },
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

  // Riepilogo per finestra
  const season_line = lineaSommario(html, 'quickseason');
  const last5 = lineaSommario(html, 'quicklastfive');
  const last10 = lineaSommario(html, 'quicklastten');
  const last20 = lineaSommario(html, 'quicklasttwenty');

  // Split mensili
  const monthly: PlayerStats['monthly'] = [];
  const msStart = html.indexOf('class="monthly-stats"');
  if (msStart >= 0) {
    const msEnd = html.indexOf('role-stats', msStart);
    const seg = senzaTag(html.slice(msStart, msEnd > 0 ? msEnd : msStart + 8000));
    const dopo = seg.split('FPPM')[1] || '';
    const reMese = /([A-Z][a-z]{2})\.\s+([-\d.\s]+?)(?=[A-Z][a-z]{2}\.|$)/g;
    let mm: RegExpExecArray | null;
    while ((mm = reMese.exec(dopo))) {
      const v = numeri(mm[2]).slice(0, 9);
      if (v.length >= 9) monthly.push({ month: mm[1], fppg: toNum(v[7]), fppm: toNum(v[8]) });
    }
  }

  // Game log (ordine cronologico inverso)
  const gamelog: PlayerGame[] = [];
  const glStart = html.indexOf('basic-game-log');
  if (glStart >= 0) {
    const glEnd = html.indexOf('Career Stats', glStart);
    const block = html.slice(glStart, glEnd > 0 ? glEnd : undefined);
    // ogni riga è ancorata dal link partita: <a href="/nba/YYYY-MM-DD/slug"
    const parts = block.split(/<a href="\/nba\/(\d{4}-\d{2}-\d{2})\/[^"]*"/);
    for (let i = 1; i < parts.length; i += 2) {
      const date = parts[i];
      const body = parts[i + 1] || '';
      const chiuso = body.indexOf('</a>');
      // opp: dentro il link, saltando il resto del tag <a ...> e il doppione desktop-hide.
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
      const v = numeri(senzaTag(dopo)).slice(0, 8); // MIN PTS REB AST BLK STL FP FPPM
      if (v.length >= 8) {
        gamelog.push({
          date,
          opp,
          min: toNum(v[0]),
          pts: toNum(v[1]),
          reb: toNum(v[2]),
          ast: toNum(v[3]),
          blk: toNum(v[4]),
          stl: toNum(v[5]),
          fp: toNum(v[6]),
          fppm: toNum(v[7]),
        });
      }
    }
  }

  const found =
    season_line.fppm !== null || monthly.length > 0 || gamelog.length > 0 || header.pos !== null;
  return { ...vuoto, found, season, header, season_line, last5, last10, last20, monthly, gamelog };
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
