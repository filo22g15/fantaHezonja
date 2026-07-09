# FantaNBA webapp — setup

App **Next.js 16** (App Router) su **Vercel** + **Supabase** (Postgres + Auth), gratis, per ~20 utenti.
Sostituisce il vecchio sito statico su GitHub Pages con: login per tutti, DB, pubblicazione via API
(niente più token GitHub in `localStorage`).

## Sviluppo locale

Questo repo usa un Node.js **portabile** in `../tools/node` (nessuna installazione di sistema).
Per usarlo nella shell corrente:

```powershell
$env:PATH = "C:\Users\filippogi\Desktop\fantaNba\tools\node;" + $env:PATH
cd web
npm run dev      # http://localhost:3000
```

## 1) Progetto Supabase (una volta)

1. Crea un progetto su https://supabase.com (piano **Free**).
2. **SQL Editor** → incolla ed esegui `web/supabase/migrations/0001_init.sql`
   (crea `profiles`, `league_state`, `league_state_history`, trigger e policy RLS).
3. **Project Settings → API**: copia `Project URL`, `anon public key`, `service_role key`.

## 2) Variabili d'ambiente

Copia `web/.env.local.example` → `web/.env.local` e compila:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...anon...
SUPABASE_SERVICE_ROLE_KEY=eyJ...service_role...   # solo per il seed, mai sul client
```

Su **Vercel** (Project → Settings → Environment Variables) imposta le stesse tre chiavi.

## 3) Seed dei dati (una volta)

Importa gli attuali `data.js` / `bacheca.js` (root del repo) in `league_state`:

```powershell
cd web
npm run seed
```

## 4) Utenti (i 20)

- **Auth → Providers**: tieni attivo **Email** (magic link). Il login è **invito-only**
  (`shouldCreateUser: false`): un'email non invitata non può entrare.
- **Auth → Users → Invite user**: invita le 20 email. Ognuno riceve il link e al primo
  accesso viene creato il suo `profiles` (ruolo `member` di default).
- **Rendi admin te stesso**: in **SQL Editor**
  ```sql
  update public.profiles set role = 'admin' where id = (
    select id from auth.users where email = 'tua@email.it'
  );
  ```

## 5) Deploy su Vercel

1. Collega il repo GitHub a Vercel.
2. **Root Directory = `web`** (importante: l'app è nella sottocartella).
3. Imposta le 3 env var (punto 2). Deploy.
4. In Supabase **Auth → URL Configuration** aggiungi il dominio Vercel come
   *Site URL* e in *Redirect URLs* aggiungi `https://<tuo-dominio>/auth/callback`.

## 6) Pipeline Python ↔ DB (contratti Spotrac / ruoli sports.ws)

Gli scraper restano **offline/locali** (Spotrac ha anti-bot). La fonte di verità è ora il
DB, quindi il giro è **DB → file → scraper → DB**:

```powershell
$env:SUPABASE_URL="https://xxxx.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="eyJ...service_role..."

python ..\pull_from_db.py          # 1) DB -> data.js / bacheca.js (parti dai dati correnti)
python ..\sincronizza.py --solo-contratti "Nome"   # 2) scraper aggiorna data.js
python ..\push_to_db.py            # 3) data.js -> DB   (--dry-run per provare)
```

**Regola d'oro:** esegui sempre `pull_from_db.py` prima di scrapare, così non sovrascrivi
col vecchio le modifiche fatte da Admin online. In alternativa, per pochi ritocchi usa
l'editing in-app (✎ / ruolo / + Aggiungi giocatore) e premi Pubblica.

## Cosa c'è già e cosa manca

**Fatto:** auth (magic link, invito-only), gate ruoli via `proxy.ts` + layout, DB con RLS,
lettura `league_state`, dashboard con cap per squadra (logica `capTotals` portata),
Server Action `publishLeague` (sostituto di `adminPublish`), seed + uploader Python.

**Prossimo passo:** portare l'editor visuale delle sezioni (Contratti/Squadre/Recap/Bacheca/Trade)
da `index.html` sopra `publishLeague`, riusando `lib/league/` come logica condivisa.
