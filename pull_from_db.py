# -*- coding: utf-8 -*-
"""
Scarica lo stato lega dal DB Supabase e riscrive i file locali data.js / bacheca.js.
È il primo pezzo del giro di sincronizzazione con gli scraper (che girano offline):

    python pull_from_db.py                 # DB  -> data.js / bacheca.js
    python sincronizza.py --solo-contratti "..."   # scraper aggiorna data.js (Spotrac/sports.ws)
    python push_to_db.py                   # data.js / bacheca.js -> DB

Così parti sempre dai dati correnti del sito (comprese le modifiche fatte da Admin online),
applichi lo scraping in locale, e ripubblichi. Evita di sovrascrivere il DB con dati stantii.

Richiede: pip install requests
Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
"""
import os
import json

import requests

ROOT = os.path.dirname(os.path.abspath(__file__))


def main():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise SystemExit("Imposta SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY nelle variabili d'ambiente.")

    endpoint = "%s/rest/v1/league_state?id=eq.1&select=data,bacheca" % url.rstrip("/")
    headers = {"apikey": key, "Authorization": "Bearer %s" % key}
    r = requests.get(endpoint, headers=headers)
    if r.status_code >= 300:
        raise SystemExit("Errore %d: %s" % (r.status_code, r.text))
    rows = r.json()
    if not rows:
        raise SystemExit("Nessuna riga league_state (id=1) nel DB. Esegui prima il seed.")

    data = rows[0].get("data") or {}
    bacheca = rows[0].get("bacheca") or {}

    with open(os.path.join(ROOT, "data.js"), "w", encoding="utf-8") as f:
        f.write("window.LEAGUE = " + json.dumps(data, ensure_ascii=False) + ";")
    with open(os.path.join(ROOT, "bacheca.js"), "w", encoding="utf-8") as f:
        f.write("window.BACHECA = " + json.dumps(bacheca, ensure_ascii=False) + ";")

    print("OK: scritti data.js (%d giocatori) e bacheca.js dal DB."
          % len(data.get("players", [])))


if __name__ == "__main__":
    main()
