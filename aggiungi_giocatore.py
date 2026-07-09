#!/usr/bin/env python3
"""Aggiunge uno o più giocatori NUOVI al sito, come free agent (senza squadra),
con ruolo (da sports.ws) e cap hit per stagione (da Spotrac).

Riusa le stesse fonti e la stessa logica anti-blocco di sincronizza.py.
Dopo averli aggiunti, dal pannello Admin del sito assegni il giocatore a una
squadra col menu FantaTeam e premi Pubblica.

Uso:
  python aggiungi_giocatore.py "Cooper Flagg" "VJ Edgecombe"
  python aggiungi_giocatore.py "Tyus Jones" --solo-ruolo      # salta Spotrac
Requisiti:  pip install requests
"""
import json
import re
import sys

import sincronizza as s   # riusa richiesta / ruolo_sportsws / caphit_spotrac / STAGIONI


def carica():
    html = open("index.html", encoding="utf-8").read()
    m = re.search(r"window\.LEAGUE = (\{.*?\});", html, re.S)
    if not m:
        sys.exit("Blocco window.LEAGUE non trovato in index.html")
    return html, json.loads(m.group(1))


def salva(html, data):
    payload = "window.LEAGUE = " + json.dumps(data, ensure_ascii=False) + ";"
    open("data.js", "w", encoding="utf-8").write(payload)
    html2 = re.sub(r"window\.LEAGUE = \{.*?\};", lambda _: payload, html, count=1, flags=re.S)
    open("index.html", "w", encoding="utf-8").write(html2)


def main():
    flags = {a for a in sys.argv[1:] if a.startswith("--")}
    nomi = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not nomi:
        sys.exit('Uso: python aggiungi_giocatore.py "Nome Giocatore" [...]')
    fai_contratto = "--solo-ruolo" not in flags

    html, data = carica()
    esistenti = {p["n"].lower() for p in data["players"]}
    aggiunti = 0

    for nome in nomi:
        if nome.lower() in esistenti:
            print(f"  - {nome}: già presente, salto.")
            continue
        print(f"  {nome}: cerco ruolo e contratto...", flush=True)

        try:
            ruolo = s.ruolo_sportsws(nome)
        except s.Bloccato:
            ruolo = None

        caphits = None
        if fai_contratto:
            try:
                caphits, url = s.caphit_spotrac(nome)
                if caphits is None:
                    print(f"    ! Spotrac: profilo/contratto non trovato ({url or '—'})")
            except s.Bloccato:
                print("    ! Spotrac ci sta bloccando: riprova più tardi (contratto a 0 per ora).")

        sal = [float((caphits or {}).get(stag, 0) or 0) for stag in s.STAGIONI]
        data["players"].append({
            "n": nome, "t": "", "r": ruolo or "", "s": "",
            "sal": sal, "opt": ["", "", "", "", ""],
        })
        esistenti.add(nome.lower())
        aggiunti += 1
        anni = sum(1 for v in sal if v)
        print(f"    ok: ruolo={ruolo or '?'} · {anni} stagioni con contratto")

    if aggiunti:
        salva(html, data)
        print(f"\nOK: {aggiunti} giocatore/i aggiunto/i come free agent.")
        print("Ora sul sito (Admin) assegnalo a una squadra col menu FantaTeam e premi Pubblica.")
    else:
        print("\nNessun giocatore aggiunto.")


if __name__ == "__main__":
    main()
