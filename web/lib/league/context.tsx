'use client';

import { createContext, useContext, useMemo, useState } from 'react';
import { publishLeague } from '@/app/actions/publishLeague';
import type { Bacheca, League } from './types';

interface LeagueCtx {
  league: League;
  origLeague: League;
  bacheca: Bacheca;
  gmByTeam: Record<string, string>;
  isAdmin: boolean;
  editMode: boolean;
  toggleEdit: () => void;
  // muta una copia profonda dello stato e ri-renderizza (marca dirty)
  updateLeague: (fn: (draft: League) => void) => void;
  updateBacheca: (fn: (draft: Bacheca) => void) => void;
  dirty: boolean;
  publishing: boolean;
  publish: () => Promise<void>;
  undo: () => void;
}

const Ctx = createContext<LeagueCtx | null>(null);

export function LeagueProvider({
  league: initLeague,
  bacheca: initBacheca,
  gmByTeam,
  isAdmin,
  children,
}: {
  league: League;
  bacheca: Bacheca;
  gmByTeam: Record<string, string>;
  isAdmin: boolean;
  children: React.ReactNode;
}) {
  const [league, setLeague] = useState(initLeague);
  const [bacheca, setBacheca] = useState(initBacheca);
  const [orig, setOrig] = useState(() => ({
    l: JSON.stringify(initLeague),
    b: JSON.stringify(initBacheca),
  }));
  const [editMode, setEditMode] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const dirty = useMemo(
    () => JSON.stringify(league) !== orig.l || JSON.stringify(bacheca) !== orig.b,
    [league, bacheca, orig]
  );
  const origLeague = useMemo(() => JSON.parse(orig.l) as League, [orig]);

  function updateLeague(fn: (draft: League) => void) {
    const draft = structuredClone(league);
    fn(draft);
    setLeague(draft);
  }
  function updateBacheca(fn: (draft: Bacheca) => void) {
    const draft = structuredClone(bacheca);
    fn(draft);
    setBacheca(draft);
  }

  async function publish() {
    setPublishing(true);
    try {
      const res = await publishLeague(league, bacheca);
      if (res.ok) {
        setOrig({ l: JSON.stringify(league), b: JSON.stringify(bacheca) });
        alert('Pubblicato! Le modifiche sono ora salvate nel database.');
      } else {
        alert('Pubblicazione fallita: ' + (res.error ?? 'errore sconosciuto'));
      }
    } finally {
      setPublishing(false);
    }
  }

  function undo() {
    setLeague(JSON.parse(orig.l));
    setBacheca(JSON.parse(orig.b));
  }

  return (
    <Ctx.Provider
      value={{
        league,
        origLeague,
        bacheca,
        gmByTeam,
        isAdmin,
        editMode,
        toggleEdit: () => setEditMode((x) => !x),
        updateLeague,
        updateBacheca,
        dirty,
        publishing,
        publish,
        undo,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useLeague() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useLeague usato fuori da LeagueProvider');
  return c;
}

// Helper derivati dalla lega (equivalenti a S/CAPS/CAP del sito originale)
export function seasons(l: League) {
  return l.seasons;
}
export function caps(l: League) {
  return l.caps && l.caps.length ? l.caps : l.seasons.map(() => l.cap || 0);
}
