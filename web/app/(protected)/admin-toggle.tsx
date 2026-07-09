'use client';

import { useLeague } from '@/lib/league/context';

export default function AdminToggle() {
  const { isAdmin, editMode, toggleEdit } = useLeague();
  if (!isAdmin) return null;
  return (
    <button
      id="adminBtn"
      className={editMode ? 'on' : ''}
      type="button"
      onClick={toggleEdit}
      title="Attiva/disattiva la modalità modifica"
    >
      ● Admin
    </button>
  );
}
