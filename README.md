# FantaHezonja Champions — Salary Cap

Sito della lega per consultare **contratti, salary cap, roster e scelte al draft** di ogni
squadra, con un **pannello Admin** per gestire spostamenti, tagli, stipendi, pick e scambi
e pubblicarli online con un clic.

Il sito è una singola pagina statica (`index.html`) ospitata su GitHub Pages: non serve
alcun server. I dati vivono nel file e vengono aggiornati direttamente dall'Admin dal sito.

---

## Le pagine pubbliche

Chiunque apra il sito vede tre sezioni (menu in alto):

- **Contratti** — tabella di tutti i giocatori: squadra, ruolo, stato e stipendio per le
  5 stagioni. Si può cercare per nome e filtrare per squadra, ruolo o stato. Clic sulle
  intestazioni per ordinare. L'icona ↗ apre il profilo del giocatore su Spotrac.
- **Squadre** — una card per squadra con lo spazio salariale della stagione corrente; clic
  su una squadra per aprire la sua pagina (roster attivo, tagliati, **scelte al draft** e
  **riepilogo cap rimanente** per ogni stagione).
- **Recap** — spazio salariale di tutte le squadre, stagione per stagione, ordinato.

---

## Le regole del salary cap

- **Cap per stagione:** 215M nel 2025/26, poi **230M** dal 2026/27 in avanti.
- **Giocatori tagliati:** restano a bilancio ma pesano sul cap per **metà** del loro
  contratto (dead money). Finiscono nella sezione *Tagliati* della pagina squadra.
- **Rinnovi da confermare (R gialla):** importi già firmati in NBA ma non ancora ratificati
  dalla lega. Sono mostrati in giallo con una **R** e **non contano** nel cap finché l'Admin
  non li converte in contratto effettivo (vedi *Confermare un rinnovo* sotto).

---

## Modalità Admin

### Come si pubblica
Ogni modifica fatta da Admin resta "in sospeso" finché non la pubblichi. In basso compare
una barra **"N modifiche da pubblicare"**:
- **Pubblica** → salva tutto online; il sito si aggiorna per tutti entro ~1 minuto.
- **Annulla** → scarta le modifiche non ancora pubblicate.

Uscendo dalla modalità Admin (riclic su ● Admin) le modifiche non pubblicate vengono scartate.

### Cosa puoi fare da Admin

| Azione | Dove | Come |
|---|---|---|
| **Spostare un giocatore** | Contratti | La colonna *FantaTeam* diventa un menu: scegli la nuova squadra (o "svincolato"). |
| **Modificare lo stipendio** | Contratti | Icona **✎** sul giocatore → le 5 celle stagione diventano modificabili → **✓** per chiudere. |
| **Confermare un rinnovo** | Contratti | Sui giocatori con la **R** gialla compare il pulsante **✓R**: un clic rende effettivi gli importi in giallo (entrano nel cap, la R sparisce). |
| **Tagliare / reintegrare** | pagina Squadra | Pulsante **Taglia** (rosso) sugli attivi, **Reintegra** (verde) sui tagliati. |
| **Gestire le scelte** | pagina Squadra, *Scelte al draft* | **↔** sposta una pick a un'altra squadra, **✕** la rimuove, **+ Aggiungi scelta** ne crea una nuova. |
| **Scambi (Trade)** | pagina **Trade** | Vedi sotto. |

### Costruttore scambi (Trade)
La voce **Trade** nel menu compare solo agli Admin. Serve a fare scambi multipli in fretta:

1. Scegli **da 2 a 4 squadre** coinvolte.
2. Per ogni squadra compaiono i suoi giocatori e le sue scelte: con il menu **"→ squadra"**
   decidi dove va ciascun asset (o "resta").
3. La colonna **Riceve** di ogni squadra si compila da sola, e il **cap proiettato** si
   aggiorna in tempo reale così controlli che lo scambio stia sotto il cap.
4. **Applica scambio** esegue tutti gli spostamenti in un colpo; poi premi **Pubblica**.

---

## Script da terminale (opzionali)

Alcune operazioni recuperano dati dal web e si eseguono da terminale. Servono **Python** e:

```
pip install requests
```

Dopo aver eseguito uno script, ricarica i file aggiornati su GitHub (oppure fai un `git push`).

### Aggiornare ruoli e contratti — `sincronizza.py`
Per ogni giocatore già presente legge il **ruolo** (da sports.ws) e il **cap hit** per
stagione (da Spotrac), con ripetizione automatica in caso di blocco temporaneo.

```
python sincronizza.py                       # tutti i giocatori
python sincronizza.py "Evan Mobley" "Ja Morant"   # solo alcuni
python sincronizza.py --solo-ruoli          # aggiorna solo i ruoli
python sincronizza.py --solo-contratti      # aggiorna solo i contratti
python sincronizza.py --sovrascrivi         # i valori di Spotrac vincono sempre
```

Di norma è prudente: gli anni già ratificati dalla lega non vengono toccati (solo segnalati
se differiscono da Spotrac); gli anni ancora vuoti vengono proposti come rinnovi (R gialla).

### Aggiungere un giocatore nuovo — `aggiungi_giocatore.py`
Aggiunge uno o più giocatori come **free agent** (senza squadra), con ruolo e stipendio
recuperati dal web.

```
python aggiungi_giocatore.py "Cooper Flagg" "VJ Edgecombe"
python aggiungi_giocatore.py "Tyus Jones" --solo-ruolo    # salta il contratto
```

Dopo averlo aggiunto, dal sito (Admin) lo cerchi in *Contratti* (filtro **Free agent**), lo
assegni a una squadra con il menu FantaTeam, eventualmente correggi lo stipendio con **✎**, e
premi **Pubblica**.

---

## File del progetto

| File | Cosa contiene |
|---|---|
| `index.html` | Tutto il sito: interfaccia, logica e dati incorporati. |
| `data.js` | Copia dei dati (aggiornata insieme a `index.html` a ogni pubblicazione). |
| `sincronizza.py` | Script: aggiorna ruoli e contratti dal web. |
| `aggiungi_giocatore.py` | Script: aggiunge un nuovo giocatore free agent. |

---

## Note tecniche

- **Fonte dei dati:** giocatori, squadre, stipendi, scelte e scambi si gestiscono dal sito.
  Gli script servono solo per recuperare ruoli/contratti dal web o aggiungere nuovi giocatori.
