# -*- coding: utf-8 -*-
"""
Carica i dati locali (data.js / bacheca.js) su Supabase (tabella league_state, id=1).
Sostituisce il "commit su GitHub" del vecchio flusso: il pipeline Python resta offline
(scraping Spotrac/sports.ws), poi spinge il risultato nel DB della webapp.

Uso:
    set SUPABASE_URL=https://xxxx.supabase.co
    set SUPABASE_SERVICE_ROLE_KEY=eyJ...service_role...
    python push_to_db.py            # carica data.js + bacheca.js
    python push_to_db.py --dry-run  # non scrive, mostra solo cosa farebbe

Richiede: pip install requests
"""
import os
import re
import sys
import json

import requests

ROOT = os.path.dirname(os.path.abspath(__file__))


def extract_global(path, var):
    with open(path, encoding="utf-8") as f:
        txt = f.read()
    m = re.search(r"window\.%s\s*=\s*(.*);\s*$" % var, txt, re.S)
    if not m:
        raise SystemExit("Blocco window.%s non trovato in %s" % (var, path))
    return json.loads(m.group(1))


def main():
    dry = "--dry-run" in sys.argv
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise SystemExit("Imposta SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY nelle variabili d'ambiente.")

    data = extract_global(os.path.join(ROOT, "data.js"), "LEAGUE")
    bacheca = extract_global(os.path.join(ROOT, "bacheca.js"), "BACHECA")
    print("Import: %d squadre, %d giocatori."
          % (len(data.get("teams", [])), len(data.get("players", []))))

    if dry:
        print("[dry-run] nessuna scrittura.")
        return

    endpoint = "%s/rest/v1/league_state?id=eq.1" % url.rstrip("/")
    headers = {
        "apikey": key,
        "Authorization": "Bearer %s" % key,
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }
    body = {"data": data, "bacheca": bacheca}
    r = requests.patch(endpoint, headers=headers, data=json.dumps(body))
    if r.status_code >= 300:
        raise SystemExit("Errore %d: %s" % (r.status_code, r.text))
    print("OK: league_state aggiornato.")


if __name__ == "__main__":
    main()
