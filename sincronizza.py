#!/usr/bin/env python3
"""Sincronizza la lega: ruoli da sports.ws + contratti da Spotrac.

Per ogni giocatore in data.js:
  1. legge il ruolo (G/GF/F/FC/C) dal profilo https://sports.ws/nba/<slug>
  2. SOLO per i free agent (senza squadra): cerca il giocatore su Spotrac,
     apre il suo profilo e legge i cap hit per stagione (2025-26 ... 2029-30)

Con i contratti lo script è prudente:
  - i giocatori SOTTO CONTRATTO in una squadra non vengono nemmeno cercati su
    Spotrac: il contratto firmato in lega è la fonte e resta quello (così si
    evita anche il blocco anti-bot su richieste inutili). I TAGLIATO, avendo
    una squadra, sono a loro volta esclusi.
  - per i free agent: gli anni vuoti (0) vengono proposti come "rinnovi da
    confermare" (campo pnd, in giallo sul sito, fuori dal cap); gli anni già
    valorizzati vengono aggiornati a Spotrac solo con --sovrascrivi

Uso:
  python3 sincronizza.py                        # tutti (~15-20 minuti)
  python3 sincronizza.py "Evan Mobley" "Ja Morant"   # solo alcuni
  python3 sincronizza.py --solo-ruoli           # salta Spotrac
  python3 sincronizza.py --solo-contratti       # salta sports.ws
  python3 sincronizza.py --sovrascrivi          # Spotrac vince, ma solo per i free agent

Requisiti: pip install requests
"""
import json
import re
import sys
import time
import unicodedata

import requests

PAUSA = 3.0  # secondi tra le richieste: sii gentile, così Spotrac non ti blocca
HEADERS = {"User-Agent": "Mozilla/5.0 (lega FantaNBA privata - sync dati)"}
STAGIONI = ["2025-26", "2026-27", "2027-28", "2028-29", "2029-30"]

# Slug/URL particolari. Aggiungi qui i casi che lo script non trova da solo:
SLUG_MANUALI = {}      # es. "Nome lega": "slug-sports-ws"
SPOTRAC_MANUALI = {}   # es. "Nome lega": "https://www.spotrac.com/nba/player/_/id/12345/nome"

sessione = requests.Session()
sessione.headers.update(HEADERS)


class Bloccato(Exception):
    """L'anti-bot ci sta limitando (HTTP 202/403/429 o risposta vuota).

    Succede se si fanno troppe richieste ravvicinate: il blocco è sull'IP ed
    e' temporaneo (di solito si sblocca da solo entro un'ora). Meglio fermarsi
    che marcare per errore tutti i giocatori come "non trovati".
    """


def richiesta(url, **kw):
    """GET con rilevamento del blocco anti-bot e attesa crescente (backoff)."""
    attesa = PAUSA
    r = None
    for tentativo in range(4):
        r = sessione.get(url, timeout=15, **kw)
        bloccato = r.status_code in (202, 403, 429) or (
            r.status_code == 200 and not r.text.strip())
        if not bloccato:
            return r
        if tentativo < 3:
            print(f"    (bloccato: HTTP {r.status_code}, attendo {attesa:.0f}s e riprovo...)", flush=True)
            time.sleep(attesa)
            attesa *= 2
    raise Bloccato(f"HTTP {r.status_code if r is not None else '?'} da {url}")


def pulisci(nome: str) -> str:
    s = unicodedata.normalize("NFKD", nome).encode("ascii", "ignore").decode()
    return s.replace("'", "").replace(".", "")


def slug(nome: str) -> str:
    if nome in SLUG_MANUALI:
        return SLUG_MANUALI[nome]
    s = re.sub(r"[^a-z0-9]+", "-", pulisci(nome).lower()).strip("-")
    return s


def senza_tag(html: str) -> str:
    return re.sub(r"<[^>]+>", " ", html)


# ---------------- sports.ws: ruolo ----------------

def ruolo_sportsws(nome: str):
    try:
        r = richiesta(f"https://sports.ws/nba/{slug(nome)}")
        if r.status_code != 200:
            return None
        m = re.search(r"Position:\s*([A-Z]{1,2})\b", senza_tag(r.text))
        if m and m.group(1) in ("G", "GF", "F", "FC", "C"):
            return m.group(1)
    except requests.RequestException:
        pass
    return None


# ---------------- Spotrac: contratti ----------------

def url_spotrac(nome: str):
    """Trova l'URL del profilo NBA del giocatore tramite la ricerca di Spotrac."""
    if nome in SPOTRAC_MANUALI:
        return SPOTRAC_MANUALI[nome]
    try:
        r = richiesta("https://www.spotrac.com/search", params={"q": pulisci(nome)})
        if r.status_code != 200:
            return None
        # 1) con un match esatto Spotrac redirige dritto al profilo
        if re.search(r"/nba/player/_/id/\d+", r.url):
            return r.url.split("?")[0]
        # 2) altrimenti scorri i risultati. Oggi i link sono dei redirect che
        #    mescolano tutti gli sport: <a href="...redirect/player/ID...">
        #    ...<img ...nba_xxx.png...> ...<span>Nome</span></a>. Prendi il
        #    risultato con logo NBA il cui nome coincide (fallback: il primo NBA).
        atteso = pulisci(nome).lower()
        primo_nba = None
        for m in re.finditer(r'href="[^"]*redirect/player/(\d+)[^"]*"(.*?)</a>', r.text, re.S):
            pid, body = m.group(1), m.group(2)
            if "nba_" not in body:
                continue
            url = f"https://www.spotrac.com/redirect/player/{pid}"
            primo_nba = primo_nba or url
            nm = re.search(r"<span[^>]*>([^<]+)</span>", body)
            if nm and pulisci(nm.group(1)).lower() == atteso:
                return url
        return primo_nba
    except requests.RequestException:
        pass
    return None


def caphit_spotrac(nome: str):
    """Ritorna {stagione: cap_hit} per le stagioni future trovate sul profilo."""
    url = url_spotrac(nome)
    if not url:
        return None, None
    time.sleep(PAUSA)
    try:
        r = richiesta(url)
        if r.status_code != 200:
            return None, url
    except requests.RequestException:
        return None, url

    trovati = {}
    # cerca le righe di tabella: stagione seguita da importi in dollari
    for riga in re.findall(r"<tr[^>]*>(.*?)</tr>", r.text, re.S):
        testo = senza_tag(riga)
        stag = next((s for s in STAGIONI if s in testo), None)
        if not stag or stag in trovati:
            continue
        importi = [int(x.replace(",", "")) for x in re.findall(r"\$([\d,]{7,})", testo)]
        importi = [x for x in importi if 1_000_000 <= x <= 100_000_000]
        if importi:
            # nelle tabelle contratto di Spotrac base salary e cap hit di norma
            # coincidono; prendiamo il valore piu' frequente della riga
            trovati[stag] = max(set(importi), key=importi.count)
    return (trovati or None), url


# ---------------- main ----------------

def main() -> None:
    flags = {a for a in sys.argv[1:] if a.startswith("--")}
    nomi = {a for a in sys.argv[1:] if not a.startswith("--")}
    fai_ruoli = "--solo-contratti" not in flags
    fai_contratti = "--solo-ruoli" not in flags
    sovrascrivi = "--sovrascrivi" in flags

    raw = open("data.js", encoding="utf-8").read()
    data = json.loads(re.search(r"window\.LEAGUE = (\{.*\});", raw, re.S).group(1))
    players = [p for p in data["players"] if not nomi or p["n"] in nomi]

    ruoli_cambiati, rinnovi, differenze, non_trovati = [], [], [], []
    interrotto = None

    for i, p in enumerate(players, 1):
        print(f"[{i}/{len(players)}] {p['n']}", flush=True)

        try:
            if fai_ruoli:
                ruolo = ruolo_sportsws(p["n"])
                if ruolo and ruolo != p.get("r"):
                    ruoli_cambiati.append(f'{p["n"]}: {p.get("r") or "?"} -> {ruolo}')
                    p["r"] = ruolo
                elif ruolo is None:
                    non_trovati.append(f'{p["n"]} (sports.ws: /nba/{slug(p["n"])})')
                time.sleep(PAUSA)

            # i contratti si cercano su Spotrac SOLO per i free agent (senza squadra):
            # chi è sotto contratto in lega è bloccato, quindi interrogarlo sarebbe
            # inutile e farebbe scattare il blocco anti-bot. I TAGLIATO hanno una
            # squadra, quindi rientrano anch'essi nell'esclusione.
            if fai_contratti and not p.get("t"):
                caphits, url = caphit_spotrac(p["n"])
                if caphits is None:
                    non_trovati.append(f'{p["n"]} (spotrac: {url or "profilo non trovato"})')
                else:
                    pnd = list(p.get("pnd") or [0, 0, 0, 0, 0])
                    for idx, stag in enumerate(STAGIONI):
                        reale = caphits.get(stag)
                        if not reale:
                            continue
                        if p["sal"][idx] == 0:
                            if pnd[idx] != reale:
                                pnd[idx] = reale
                                rinnovi.append(f'{p["n"]} {stag}: {reale:,}'.replace(",", "."))
                        elif abs(p["sal"][idx] - reale) > 1000:
                            # qui siamo gia' su un free agent (i giocatori sotto contratto non
                            # vengono nemmeno interrogati): con --sovrascrivi allineiamo a Spotrac.
                            if sovrascrivi:
                                differenze.append(f'{p["n"]} {stag}: {p["sal"][idx]:,.0f} -> {reale:,} (AGGIORNATO, free agent)'.replace(",", "."))
                                p["sal"][idx] = float(reale)
                            else:
                                differenze.append(f'{p["n"]} {stag}: free agent, lega {p["sal"][idx]:,.0f} vs Spotrac {reale:,}'.replace(",", "."))
                    if any(pnd):
                        p["pnd"] = pnd
                time.sleep(PAUSA)

        except Bloccato as e:
            interrotto = (i, str(e))
            print(f"\n!! Fermato: l'anti-bot ci sta bloccando ({e}).", flush=True)
            print("   Salvo quanto raccolto finora e mi fermo. Riprova tra un'ora", flush=True)
            print("   (il blocco e' temporaneo e sull'IP), oppure da un'altra rete.", flush=True)
            break

    payload = "window.LEAGUE = " + json.dumps(data, ensure_ascii=False) + ";"
    open("data.js", "w", encoding="utf-8").write(payload)
    try:
        html = open("index.html", encoding="utf-8").read()
        html = re.sub(r"window\.LEAGUE = \{.*?\};", payload, html, count=1, flags=re.S)
        open("index.html", "w", encoding="utf-8").write(html)
    except FileNotFoundError:
        pass

    print("\n================ RIEPILOGO ================")
    if interrotto:
        i, motivo = interrotto
        print(f"\n!! INTERROTTO al giocatore {i}/{len(players)} per blocco anti-bot ({motivo}).")
        print("   I giocatori successivi NON sono stati sincronizzati. Rilancia piu' tardi")
        print("   con gli stessi argomenti per completare (gli anni ratificati non vengono ri-toccati).")
    print(f"\nRuoli cambiati ({len(ruoli_cambiati)}):")
    for x in ruoli_cambiati: print("  ", x)
    print(f"\nRinnovi aggiunti/aggiornati ({len(rinnovi)}):")
    for x in rinnovi: print("  ", x)
    print(f"\nDifferenze sugli stipendi dei free agent ({len(differenze)}):")
    for x in differenze: print("  ", x)
    if not sovrascrivi and differenze:
        print("   (sono free agent: rilancia con --sovrascrivi per allinearli a Spotrac)")
    print("   NB: i giocatori sotto contratto non vengono nemmeno cercati su Spotrac.")
    print(f"\nNon trovati ({len(non_trovati)}) — correggi in SLUG_MANUALI / SPOTRAC_MANUALI:")
    for x in non_trovati: print("  ", x)
    print("\nFatto. Ricarica index.html (o data.js) su GitHub per pubblicare.")


if __name__ == "__main__":
    main()
