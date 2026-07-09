# FantaHezonja Champions — Salary Cap

Sito della lega per consultare **contratti, salary cap, roster e scelte al draft** di ogni
squadra, con un **pannello Admin** per gestire spostamenti, tagli, stipendi, pick e scambi
e pubblicarli online con un clic.

Il sito è una **webapp** (Next.js + Supabase, ospitata su Vercel) con **account personali**
per i membri della lega: i dati vivono in un database Supabase e vengono aggiornati direttamente
dall'Admin dal sito, con pubblicazione in un clic. Il codice della webapp sta nella cartella
[`web/`](web/); la pipeline Python di supporto (scraping contratti/ruoli, avanzamento stagione,
Bacheca) resta a parte e sincronizza col DB.

> Esiste anche la versione storica a **pagina statica** (`index.html`, un tempo su GitHub Pages):
> gli stessi contenuti e le stesse regole, ma senza account né database. La documentazione delle
> regole e delle azioni Admin qui sotto vale per entrambe.

---

## Le pagine pubbliche

Chiunque apra il sito vede tre sezioni (menu in alto):

- **Contratti** — tabella di tutti i giocatori: squadra, ruolo, stato e stipendio per le
  5 stagioni. Si può cercare per nome e filtrare per squadra, ruolo o stato. Clic sulle
  intestazioni per ordinare. L'icona ↗ apre il profilo del giocatore su Spotrac.
- **Squadre** — una card per squadra con lo spazio salariale della stagione corrente; clic
  su una squadra per aprire la sua pagina (roster attivo, tagliati, **penali da tagli**,
  **scelte al draft** e **riepilogo cap rimanente** per ogni stagione).
- **Recap** — spazio salariale di tutte le squadre, stagione per stagione, ordinato.
- **Bacheca** — albo d'oro (campioni, conference e division), premi individuali (MVP/MIP/ROY/COY),
  record di squadra e individuali, medagliere e maglie ritirate. Si aggiorna sia dall'Excel
  (`aggiorna_bacheca.py`) sia direttamente da **Admin** sul sito (vedi *Modalità Admin*).

---

## Le regole del salary cap

- **Cap per stagione:** 215M nel 2025/26, poi **230M** dal 2026/27 in avanti.
- **Giocatori tagliati:** restano a bilancio ma pesano sul cap per **metà** del loro
  contratto (dead money), **solo sulle stagioni garantite**. Le stagioni con opzione **NG**
  (Not Guaranteed) **non** pesano; le opzioni **T** e **P** invece contano come garantite.
  Finiscono nella sezione *Tagliati* della pagina squadra.
- **Tagliato e rifirmato altrove (penale):** se una squadra taglia un giocatore e questo
  **rifirma con un'altra squadra**, la penale (metà dello stipendio garantito residuo) resta
  a carico della squadra che l'ha tagliato, mentre il nuovo contratto va sulla nuova squadra.
  La penale compare nella sezione *Penali da tagli* della vecchia squadra. Nota di lega: **chi
  taglia non può rifirmare** lo stesso giocatore.
- **Rinnovi da confermare (R gialla):** importi già firmati in NBA ma non ancora ratificati
  dalla lega. Sono mostrati in giallo con una **R** e **non contano** nel cap finché non
  vengono confermati (basta impostare lo stipendio di quella stagione, vedi sotto).

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
| **Impostare una penale** | Contratti | Sempre con l'icona **✎**: sotto il giocatore compare la riga **Penale (dead money)** → scegli la squadra che ha tagliato e inserisci lo stipendio garantito residuo (0 nelle stagioni NG). Vedi *rifirma* qui sotto. |
| **Tagliare / reintegrare** | pagina Squadra | Pulsante **Taglia** (rosso) sugli attivi, **Reintegra** (verde) sui tagliati. |
| **Azzerare una penale** | pagina Squadra | Nella sezione *Penali da tagli*, il pulsante **✕** rimuove la penale (es. quando il contratto residuo scade). |
| **Gestire le scelte** | pagina Squadra, *Scelte al draft* | **↔** sposta una pick a un'altra squadra, **✕** la rimuove, **+ Aggiungi scelta** ne crea una nuova. |
| **Aggiornare la Bacheca** | pagina **Bacheca** | In Admin la pagina diventa un editor: campi per campione/premi/conference/division/record/maglie. **+ Aggiungi riga** e **✕** per righe. Il medagliere si ricalcola da solo. Poi **Pubblica**. |
| **Avanzare la stagione** | pagina **Recap** | Pulsante **⏭ Avanza stagione**. Vedi sotto. |
| **Scambi (Trade)** | pagina **Trade** | Vedi sotto. |
| **Gestire gli utenti** | pagina **Admin → Utenti** | Assegni nome (GM) e squadra a ogni membro e reimposti le password. Vedi *Gestione accessi*. |

### Avanzare di un anno (fine stagione)

Quando una stagione è finita e vuoi passare a quella successiva (es. da **2025/26** a
**2026/27**), da Admin apri la pagina **Recap** e premi **⏭ Avanza stagione**. L'operazione
fa **scorrere di un anno la finestra delle 5 stagioni**:

- la stagione più vecchia (2025/26) **esce** dai contratti, dal cap e dalle opzioni;
- tutti gli stipendi, le opzioni e le penali (*dead money*) **scalano di una posizione**;
- viene aggiunta in coda una **nuova stagione vuota** (es. 2030/31), con cap uguale all'ultimo;
- le **scelte del draft dell'anno appena concluso** (es. 2026) vengono **eliminate**;
- ogni squadra riceve le sue **3 nuove scelte** del draft che entra nell'orizzonte (es. 2029),
  una per giro (1°, 2°, 3°), intestate alla squadra stessa (poi le puoi scambiare/rinominare);
- le penali e i rinnovi che così si azzerano **scompaiono** da soli.

Lo **storico non si tocca**: la Bacheca (albo d'oro, premi, record) resta com'è. Il campione
della stagione conclusa va *aggiunto* all'albo d'oro, non è parte di questa operazione.

Serve prima **pubblicare o annullare** eventuali modifiche in sospeso; poi al click compare una
richiesta di conferma e, all'OK, la modifica **viene pubblicata subito** online. Finché non
confermi (o se la pubblicazione fallisce) puoi sempre premere **Annulla** per tornare indietro.

> L'Excel `FantaNBA.xlsx` **non** viene aggiornato: questa operazione riguarda solo il sito.
> In alternativa allo stesso risultato c'è lo script `avanza_stagione.py` (vedi sotto).

### Registrare un taglio + rifirma

Quando una nostra squadra taglia un giocatore e **un'altra lo rifirma**, il *dead money* resta a
carico di chi l'ha tagliato e il nuovo contratto pesa sulla squadra che lo prende. Regola di lega:
**chi taglia non può rifirmare** lo stesso giocatore. Ci sono due casi.

#### Caso 1 — il contratto NBA non cambia
Il giocatore cambia solo di mano dentro la nostra lega (in NBA il suo contratto è lo stesso).

- **Vecchia squadra** → *dead money* = metà dello stipendio garantito residuo.
- **Nuova squadra** → si prende il **contratto pieno** (lo stesso `sal` di prima).

Passi da Admin, in *Contratti* con l'icona **✎**:
1. Riga **Penale (dead money)** → scegli la **vecchia squadra** e inserisci lo **stipendio
   garantito residuo** (0 nelle stagioni NG). Conta per metà.
2. Menu **FantaTeam** → la **nuova squadra**; riportalo **ATTIVO** (pagina Squadra → *Reintegra*,
   se serve). Lo stipendio resta invariato.
3. **Pubblica.**

#### Caso 2 — in NBA firma un contratto diverso (di solito più basso)
Il giocatore, dopo essere stato tagliato da noi, firma un **nuovo contratto NBA**, e una nostra
squadra lo prende a quel contratto.

- **Vecchia squadra** → penale = metà del garantito residuo del **vecchio** contratto (quello che
  aveva *quando l'abbiamo tagliato*).
- **Nuova squadra** → cap hit = il **nuovo** contratto NBA (più basso).

> ⚠️ **L'ordine conta.** `sal` è un campo unico: appena lo aggiorni al nuovo contratto (a mano o
> con `sincronizza.py`) il vecchio numero sparisce. Quindi **prima** congela la penale, **poi**
> aggiorna lo stipendio.

Passi da Admin, in *Contratti* con l'icona **✎**:
1. **Prima** la penale: riga **Penale (dead money)** → **vecchia squadra** + il **vecchio**
   stipendio garantito residuo (0 nelle stagioni NG).
2. **Poi** menu **FantaTeam** → **nuova squadra**, **ATTIVO**, e inserisci il **nuovo contratto**
   più basso nelle celle stagione.
3. **Pubblica.**

#### Avvertenze (valide per entrambi i casi)
- **Non lasciarlo `TAGLIATO` sulla vecchia squadra** quando imposti la penale: va spostato alla
  nuova squadra e rimesso ATTIVO. Se resta TAGLIATO su una squadra *e* ha la penale verso la
  stessa squadra, il *dead money* viene **contato due volte**.
- **La penale si calcola a mano:** il campo penale sono numeri puri (senza le sigle T/P/NG).
  Inserisci il garantito residuo del vecchio contratto e metti **0** nelle stagioni NG.
- **Comportamento degli script:** finché è `TAGLIATO`, `sincronizza.py` **non** aggiorna il suo
  `sal` (lo salta), quindi non rovina il vecchio numero prima che tu congeli la penale. Un giocatore
  **sotto contratto in una squadra è bloccato**: lo script non gli riscrive mai `sal`. Per portare il
  **nuovo** contratto NBA alla nuova squadra hai due strade: inserirlo a mano con **✎**, oppure —
  prima di assegnarlo — lasciarlo **svincolato** (free agent) e lanciare `sincronizza.py --sovrascrivi`
  che aggiorna `sal` solo per i free agent; poi lo assegni alla nuova squadra. La penale (`dead`) non
  viene **mai** toccata in nessun caso.

### Costruttore scambi (Trade)
La voce **Trade** nel menu compare solo agli Admin. Serve a fare scambi multipli in fretta:

1. Scegli **da 2 a 4 squadre** coinvolte.
2. Per ogni squadra compaiono i suoi giocatori e le sue scelte: con il menu **"→ squadra"**
   decidi dove va ciascun asset (o "resta").
3. La colonna **Riceve** di ogni squadra si compila da sola, e il **cap proiettato** si
   aggiorna in tempo reale così controlli che lo scambio stia sotto il cap.
4. **Applica scambio** esegue tutti gli spostamenti in un colpo; poi premi **Pubblica**.

### Gestione accessi (solo webapp)

Sulla webapp ogni membro ha un **account** (email + password) gestito da Supabase Auth. **Non c'è
auto-registrazione**: un utente nuovo non può iscriversi da solo. Le password sono **cifrate** e
non rileggibili — puoi solo reimpostarle.

**Dare accesso a un membro nuovo (primo accesso):**

1. **Crea l'utente in Supabase** → dashboard del progetto → *Authentication → Users → Add user*:
   inserisci **email** e una **password provvisoria**, e spunta **Auto Confirm User** (altrimenti
   l'account resta in attesa di conferma via email).
2. Nella webapp vai in **Admin → Utenti**: assegna al nuovo membro il **nome (GM)** e la sua
   **squadra**.
3. **Comunica al membro email + password provvisoria.** Lui entra dalla pagina di login.

**Reimpostare una password:** in **Admin → Utenti**, colonna *Password* → **🔑 Reimposta**
(minimo 6 caratteri). La nuova password va comunicata al membro (Supabase non mostra quella vecchia).

> **Accesso senza password (magic link):** la pagina di login ha anche *"inviami un link via email"*.
> Funziona solo se l'utente **esiste già** in Supabase e se è configurato l'invio email (SMTP) nel
> progetto Supabase — non crea account nuovi.

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
python sincronizza.py --sovrascrivi         # Spotrac vince, ma solo per i free agent
```

**I contratti si cercano su Spotrac SOLO per i free agent.** Un giocatore **sotto contratto in una
squadra** non viene nemmeno **cercato** su Spotrac: il contratto sul sito è il deal della lega e resta
quello. Così si evita lavoro inutile e il blocco anti-bot su centinaia di richieste. Anche i
giocatori `TAGLIATO` (che hanno una squadra) sono esclusi, e la penale (`dead`) non viene mai toccata.

Per i **free agent** (senza squadra):
- gli anni **vuoti** (0) vengono proposti come rinnovi *R gialla* da confermare (`pnd`, fuori dal cap);
- gli anni già valorizzati vengono aggiornati a Spotrac **solo con `--sovrascrivi`** (senza, la
  differenza è solo segnalata nel riepilogo).

> Il **ruolo** (da sports.ws) viene invece letto per tutti i giocatori. Se vuoi la sincronizzazione più
> leggera possibile — solo i contratti dei free agent, saltando i ruoli — usa `--solo-contratti`.

### Rimettere tutti i contratti uguali all'Excel — `aggiorna_dati.py`
Rigenera `data.js` (e i dati dentro `index.html`) **dal foglio _Contratti_ dell'Excel**
`FantaNBA.xlsx`. Serve quando vuoi riportare il sito a combaciare con l'Excel, che resta la
fonte "maestra".

```
python aggiorna_dati.py FantaNBA.xlsx
```

- **Cosa reimposta dall'Excel:** per **ogni** giocatore squadra, stato, stipendi e opzioni
  (l'intero foglio *Contratti*). È un ripristino completo, non solo gli stipendi.
- **Cosa conserva dal sito** (perché l'Excel non li conosce): i **rinnovi da confermare**
  (`pnd`, R gialla), le **scelte al draft** delle squadre e le **penali** (`dead`, il dead money
  da taglio+rifirma).
- **Attenzione:** eventuali modifiche fatte da Admin sul sito e **non** riportate nell'Excel
  (spostamenti, tagli, stipendi corretti a mano) vengono **sovrascritte**. Prima di lanciarlo,
  assicurati che l'Excel sia la versione buona.

Dopo averlo eseguito, fai `git commit` + `git push` (oppure ricarica i file su GitHub) per
pubblicare.

### Aggiornare la Bacheca — `aggiorna_bacheca.py`
Rigenera i dati della pagina **Bacheca** (albo d'oro, premi, record, medagliere, maglie ritirate)
leggendo i tre Excel della lega e scrivendo il blocco `window.BACHECA` dentro `index.html` (e in
`bacheca.js`).

```
python aggiorna_bacheca.py
```

Fonti lette (devono stare nella cartella del progetto):
- `ALBO D'ORO & PREMI INDIVIDUALI - FantaNBA Hezonja.xlsx` — finals, conference/division, premi individuali;
- `Il file dei Record del FantaNBA.xlsx` — record di squadra e individuali;
- `FantaNBA.xlsx`, foglio *Bacheca* — maglie ritirate.

Il **medagliere** (titoli per squadra) è calcolato dai campioni delle finals. È indipendente da
`aggiorna_dati.py`: i due script toccano blocchi diversi (`window.BACHECA` vs `window.LEAGUE`) e non
si sovrascrivono. Dopo, `git commit` + `git push` per pubblicare.

> ⚠️ La Bacheca si può aggiornare **anche da Admin** sul sito. Attenzione: `aggiorna_bacheca.py`
> **rigenera** l'intero `window.BACHECA` dall'Excel, quindi sovrascrive le modifiche fatte da Admin
> che non hai riportato nell'Excel. Scegli un flusso solo: o aggiorni dall'Excel, o da Admin (e in tal
> caso non rilanciare lo script, oppure tieni l'Excel allineato).

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

### Avanzare di un anno da terminale — `avanza_stagione.py`
Fa la stessa cosa del pulsante **⏭ Avanza stagione** (vedi *Modalità Admin*), ma da terminale:
fa scorrere di un anno la finestra delle 5 stagioni, elimina le scelte del draft dell'anno
appena concluso, assegna a ogni squadra le 3 pick del nuovo draft e aggiorna **solo**
`index.html` e `data.js` (con backup `.bak`). Non tocca né la Bacheca né l'Excel.

```
python avanza_stagione.py --dry-run   # mostra cosa farebbe, senza scrivere
python avanza_stagione.py             # esegue
```

Dopo, `git commit` + `git push` per pubblicare.

---

## File del progetto

| File | Cosa contiene |
|---|---|
| `web/` | La **webapp** Next.js + Supabase (interfaccia, azioni admin, auth). Vedi `web/`. |
| `index.html` | Versione storica a pagina statica: interfaccia, logica e dati incorporati. |
| `data.js` | Copia dei dati (aggiornata insieme a `index.html` a ogni pubblicazione). |
| `sincronizza.py` | Script: aggiorna ruoli e contratti dal web. |
| `aggiorna_dati.py` | Script: rigenera i dati dall'Excel (`FantaNBA.xlsx`). |
| `aggiorna_bacheca.py` | Script: rigenera la pagina Bacheca dai tre Excel. |
| `aggiungi_giocatore.py` | Script: aggiunge un nuovo giocatore free agent. |
| `avanza_stagione.py` | Script: fa scorrere di un anno la finestra delle stagioni (solo sito). |
| `bacheca.js` | Copia dei dati della Bacheca (rigenerata da `aggiorna_bacheca.py`). |
| `FantaNBA.xlsx` | Excel "maestro": foglio *Contratti* + un foglio per squadra + *Bacheca*. |
| `ALBO D'ORO & PREMI INDIVIDUALI - FantaNBA Hezonja.xlsx` | Excel: albo d'oro e premi individuali. |
| `Il file dei Record del FantaNBA.xlsx` | Excel: record di squadra e individuali. |

---

## Note tecniche

- **Fonte dei dati:** giocatori, squadre, stipendi, scelte e scambi si gestiscono dal sito.
  Gli script servono solo per recuperare ruoli/contratti dal web o aggiungere nuovi giocatori.
