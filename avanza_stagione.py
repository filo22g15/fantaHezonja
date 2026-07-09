#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
avanza_stagione.py — fa scorrere di un anno la finestra delle 5 stagioni.

Rimuove la stagione piu' vecchia (es. 2025/26) da contratti, cap, opzioni e penali,
aggiunge una nuova stagione vuota in coda (es. 2030/31) ed elimina le scelte del draft
dell'anno appena concluso. Aggiorna SOLO il sito: index.html e data.js.
Lo storico (Bacheca / albo d'oro, window.BACHECA) NON viene toccato.
L'Excel FantaNBA.xlsx NON viene toccato.

Uso:
    python avanza_stagione.py            # esegue (con backup .bak)
    python avanza_stagione.py --dry-run  # mostra cosa farebbe, senza scrivere nulla

Dopo l'esecuzione: git commit + git push (o ricarica i file su GitHub).
"""
import json
import re
import sys
import shutil

INDEX = "index.html"
DATAJS = "data.js"
LEAGUE_RE = re.compile(r"window\.LEAGUE = (\{.*?\});", re.S)


def next_season_label(last):
    """'2029/30' -> '2030/31'"""
    y = int(str(last)[:4]) + 1
    return "%d/%02d" % (y, (y + 1) % 100)


def roll_league(L):
    """Fa scorrere la finestra di un anno. Muta L e ritorna un riepilogo."""
    seasons = L["seasons"]
    rimossa = seasons[0]
    drop_year = int(str(rimossa)[:4]) + 1          # draft dell'anno appena concluso
    nuova = next_season_label(seasons[-1])

    # stagioni
    seasons.pop(0)
    seasons.append(nuova)

    # cap per stagione (il nuovo ripete l'ultimo)
    caps = L.get("caps")
    if caps:
        caps.pop(0)
        caps.append(caps[-1])
        if "cap" in L:
            L["cap"] = caps[0]                     # campo legacy coerente col cap corrente

    # giocatori: sal, opt, pnd, dead scorrono di un anno
    penali_scadute = 0
    rinnovi_scaduti = 0
    for p in L.get("players", []):
        sal = p.get("sal") or [0, 0, 0, 0, 0]
        sal.pop(0)
        sal.append(0)
        p["sal"] = sal

        opt = p.get("opt") or ["", "", "", "", ""]
        opt.pop(0)
        opt.append("")
        p["opt"] = opt

        if p.get("pnd"):
            p["pnd"].pop(0)
            p["pnd"].append(0)
            if not any(p["pnd"]):
                del p["pnd"]
                rinnovi_scaduti += 1

        if p.get("dead") and p["dead"].get("sal"):
            p["dead"]["sal"].pop(0)
            p["dead"]["sal"].append(0)
            if not any(p["dead"]["sal"]):
                del p["dead"]
                penali_scadute += 1

    # nuovo anno di draft che entra in coda all'orizzonte (max esistente + 1)
    max_y = 0
    for t in L.get("teams", []):
        for pk in (t.get("picks") or []):
            if pk.get("y", 0) > max_y:
                max_y = pk["y"]
    new_draft = max_y + 1 if max_y else drop_year + 3

    # via le scelte del draft concluso; a ogni squadra le sue 3 pick del nuovo draft (1°,2°,3° giro)
    pick_rimosse = 0
    pick_aggiunte = 0
    for t in L.get("teams", []):
        picks = t.get("picks") if isinstance(t.get("picks"), list) else []
        prima = len(picks)
        picks = [pk for pk in picks if pk.get("y") != drop_year]
        pick_rimosse += prima - len(picks)
        for rd in (1, 2, 3):
            picks.append({"y": new_draft, "rd": rd, "from": t["name"]})
            pick_aggiunte += 1
        t["picks"] = picks

    return {
        "rimossa": rimossa,
        "nuova": nuova,
        "drop_year": drop_year,
        "new_draft": new_draft,
        "penali_scadute": penali_scadute,
        "rinnovi_scaduti": rinnovi_scaduti,
        "pick_rimosse": pick_rimosse,
        "pick_aggiunte": pick_aggiunte,
        "corrente": seasons[0],
    }


def main():
    dry = "--dry-run" in sys.argv

    with open(INDEX, encoding="utf-8") as f:
        html = f.read()

    m = LEAGUE_RE.search(html)
    if not m:
        sys.exit('Errore: blocco "window.LEAGUE = {...};" non trovato in ' + INDEX)

    L = json.loads(m.group(1))
    info = roll_league(L)

    print("Avanzamento stagione:")
    print("  rimossa:            %s" % info["rimossa"])
    print("  nuova stagione:     %s (in coda)" % info["nuova"])
    print("  stagione corrente:  %s" % info["corrente"])
    print("  pick draft %d rimosse: %d" % (info["drop_year"], info["pick_rimosse"]))
    print("  pick draft %d aggiunte: %d (3 per squadra)" % (info["new_draft"], info["pick_aggiunte"]))
    print("  penali scadute:     %d" % info["penali_scadute"])
    print("  rinnovi scaduti:    %d" % info["rinnovi_scaduti"])

    # serializza compatto come fa il sito (JSON puro, niente __i qui perche' e' il file su disco)
    payload_json = json.dumps(L, ensure_ascii=False)
    payload = "window.LEAGUE = " + payload_json + ";"

    if dry:
        print("\n--dry-run: nessun file scritto.")
        return

    # backup
    shutil.copy2(INDEX, INDEX + ".bak")
    nuovo_html = LEAGUE_RE.sub(lambda _: payload, html, count=1)
    with open(INDEX, "w", encoding="utf-8") as f:
        f.write(nuovo_html)

    try:
        shutil.copy2(DATAJS, DATAJS + ".bak")
    except OSError:
        pass
    with open(DATAJS, "w", encoding="utf-8") as f:
        f.write(payload)

    print("\nScritti %s e %s (backup .bak creati)." % (INDEX, DATAJS))
    print("Ora: git commit + git push per pubblicare.")


if __name__ == "__main__":
    main()
