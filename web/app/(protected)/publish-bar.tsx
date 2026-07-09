'use client';

import { useLeague } from '@/lib/league/context';

export default function PublishBar() {
  const { isAdmin, dirty, publishing, publish, undo } = useLeague();
  if (!isAdmin || !dirty) return null;
  return (
    <div className="pubbar show">
      <span className="msg">
        <b>Modifiche non pubblicate</b> · non sono ancora online
      </span>
      <button className="undo" type="button" onClick={undo} disabled={publishing}>
        Annulla
      </button>
      <button className="go" type="button" onClick={publish} disabled={publishing}>
        {publishing ? 'Pubblico…' : 'Pubblica'}
      </button>
    </div>
  );
}
