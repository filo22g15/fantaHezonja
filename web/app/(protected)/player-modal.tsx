'use client';

// Popup statistiche giocatore: click sul nome → modal con i dati scrapati da
// sports.ws (via /api/player-stats). Un solo modal condiviso a livello di layout;
// ogni <PlayerName> apre quello tramite il context.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { PlayerStats } from '@/lib/scrape';

const Ctx = createContext<{ open: (name: string) => void } | null>(null);

export function PlayerName({ n }: { n: string }) {
  const ctx = useContext(Ctx);
  if (!ctx) return <>{n}</>; // fallback: fuori dal provider resta testo semplice
  return (
    <button
      type="button"
      className="pname-btn"
      title={`Statistiche di ${n}`}
      onClick={() => ctx.open(n)}
    >
      {n}
    </button>
  );
}

type State =
  | { status: 'loading'; name: string }
  | { status: 'ok'; name: string; data: PlayerStats }
  | { status: 'error'; name: string; message: string };

const line = (l?: { fppg: number | null; fppm: number | null }) =>
  l && l.fppm !== null ? `${l.fppm.toFixed(2)}` : '—';
const lineG = (l?: { fppg: number | null; fppm: number | null }) =>
  l && l.fppg !== null ? l.fppg.toFixed(1) : '—';
const nz = (v: number | null, d = 1) => (v === null ? '—' : v.toFixed(d));

const MESI: Record<string, string> = {
  Oct: 'Ott', Nov: 'Nov', Dec: 'Dic', Jan: 'Gen', Feb: 'Feb',
  Mar: 'Mar', Apr: 'Apr', May: 'Mag', Jun: 'Giu', Sep: 'Set',
};

function ModalBody({ st }: { st: State }) {
  if (st.status === 'loading')
    return (
      <div className="pm-center">
        <span className="pm-spinner" /> Carico le statistiche di {st.name}…
      </div>
    );
  if (st.status === 'error')
    return <div className="pm-center pm-err">{st.message}</div>;

  const d = st.data;
  if (!d.found)
    return (
      <div className="pm-center">
        Nessuna statistica trovata per <strong>{st.name}</strong> su sports.ws.
        <br />
        <a className="ext" href={d.url} target="_blank" rel="noopener">
          Apri la ricerca su sports.ws &#8599;
        </a>
      </div>
    );

  const games = d.gamelog.slice(0, 15);
  return (
    <>
      <div className="pm-head">
        {d.header.photo && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img className="pm-photo" src={d.header.photo} alt={d.name} />
        )}
        <div>
          <h3>{d.name}</h3>
          <div className="pm-sub">
            {[d.header.team, d.header.pos, d.season].filter(Boolean).join(' · ')}
          </div>
          <div className="pm-sub dim">
            {[
              d.header.height && `H ${d.header.height}`,
              d.header.weight && `${d.header.weight} lbs`,
              d.header.age && `${d.header.age} anni`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </div>
        </div>
      </div>

      {/* Riepilogo FPPM per finestra temporale */}
      <div className="pm-cards">
        {[
          { k: 'Stagione', l: d.season_line },
          { k: 'Ultime 5', l: d.last5 },
          { k: 'Ultime 10', l: d.last10 },
          { k: 'Ultime 20', l: d.last20 },
        ].map((c) => (
          <div className="pm-card" key={c.k}>
            <div className="pm-card-k">{c.k}</div>
            <div className="pm-card-fppm">{line(c.l)}</div>
            <div className="pm-card-fppg">
              {lineG(c.l)} FPPG · {c.l.gp} GP
            </div>
          </div>
        ))}
      </div>
      <div className="pm-note">
        FP e FPPM calcolati col <strong>punteggio della lega</strong> (custom), non con quello
        standard di sports.ws.
      </div>

      {/* Split mensili */}
      {d.monthly.length > 0 && (
        <>
          <h4 className="pm-h4">Per mese ({d.season})</h4>
          <div className="pm-tablewrap">
            <table className="pm-table">
              <thead>
                <tr>
                  <th>Mese</th>
                  <th>GP</th>
                  <th>FPPG</th>
                  <th>FPPM</th>
                </tr>
              </thead>
              <tbody>
                {d.monthly.map((m) => (
                  <tr key={m.month}>
                    <td>{MESI[m.month] ?? m.month}</td>
                    <td>{m.gp}</td>
                    <td>{m.fppg?.toFixed(1) ?? '—'}</td>
                    <td className="pm-strong">{m.fppm?.toFixed(2) ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Game log recente */}
      {games.length > 0 && (
        <>
          <h4 className="pm-h4">Ultime partite</h4>
          <div className="pm-tablewrap">
            <table className="pm-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Match</th>
                  <th>MIN</th>
                  <th>PTS</th>
                  <th>REB</th>
                  <th>AST</th>
                  <th>BLK</th>
                  <th>STL</th>
                  <th>TO</th>
                  <th>FP</th>
                  <th>FPPM</th>
                </tr>
              </thead>
              <tbody>
                {games.map((g) => (
                  <tr key={g.date}>
                    <td>{g.date.slice(5)}</td>
                    <td className="pm-opp">{g.opp ?? '—'}</td>
                    <td>{nz(g.min)}</td>
                    <td>{nz(g.pts, 0)}</td>
                    <td>{nz(g.reb, 0)}</td>
                    <td>{nz(g.ast, 0)}</td>
                    <td>{nz(g.blk, 0)}</td>
                    <td>{nz(g.stl, 0)}</td>
                    <td>{nz(g.to, 0)}</td>
                    <td>{nz(g.fp)}</td>
                    <td className="pm-strong">{nz(g.fppm, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="pm-foot">
        <a className="ext" href={d.url} target="_blank" rel="noopener">
          Apri la pagina completa su sports.ws &#8599;
        </a>
      </div>
    </>
  );
}

export function PlayerModalProvider({ children }: { children: React.ReactNode }) {
  const [st, setSt] = useState<State | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const reqId = useRef(0);

  const open = useCallback(async (name: string) => {
    const id = ++reqId.current;
    setSt({ status: 'loading', name });
    dialogRef.current?.showModal();
    try {
      const r = await fetch(`/api/player-stats?name=${encodeURIComponent(name)}`);
      const body = await r.json();
      if (id !== reqId.current) return; // superata da un'apertura successiva
      if (!r.ok) {
        setSt({ status: 'error', name, message: body?.error ?? 'Errore nel caricamento.' });
        return;
      }
      setSt({ status: 'ok', name, data: body as PlayerStats });
    } catch {
      if (id !== reqId.current) return;
      setSt({ status: 'error', name, message: 'Errore di rete. Riprova.' });
    }
  }, []);

  const close = useCallback(() => {
    dialogRef.current?.close();
    reqId.current++; // invalida eventuali fetch in volo
    setSt(null);
  }, []);

  // Chiudi cliccando sul backdrop (fuori dalla card)
  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    const onClick = (e: MouseEvent) => {
      if (e.target === dlg) close();
    };
    dlg.addEventListener('click', onClick);
    return () => dlg.removeEventListener('click', onClick);
  }, [close]);

  return (
    <Ctx.Provider value={{ open }}>
      {children}
      <dialog ref={dialogRef} className="pm-dialog" onCancel={close}>
        {st && (
          <div className="pm-inner">
            <button type="button" className="pm-close" onClick={close} aria-label="Chiudi">
              &times;
            </button>
            <ModalBody st={st} />
          </div>
        )}
      </dialog>
    </Ctx.Provider>
  );
}
