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

async function urlSpotrac(nome: string): Promise<string | null> {
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

// Ritorna { stagione(Spotrac): cap_hit } per le stagioni richieste.
async function caphitSpotrac(nome: string, stagioni: string[]): Promise<Record<string, number> | null> {
  const url = await urlSpotrac(nome);
  if (!url) return null;
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

export interface SyncResult {
  role: string | null;
  // cap hit per indice di stagione (allineato a league.seasons), null se non trovato
  sal: (number | null)[];
  found: boolean;
}

// stagioni = league.seasons (es. ["2025/26",...]); le converto al formato Spotrac ("2025-26").
export async function syncPlayer(nome: string, stagioni: string[]): Promise<SyncResult> {
  const spotracSeasons = stagioni.map((s) => s.replace('/', '-'));
  const [role, caphits] = await Promise.all([
    ruoloSportsws(nome),
    caphitSpotrac(nome, spotracSeasons),
  ]);
  const sal = spotracSeasons.map((s) => (caphits && caphits[s]) || null);
  return { role, sal, found: role !== null || sal.some((v) => v !== null) };
}
