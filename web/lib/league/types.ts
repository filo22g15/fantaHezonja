// Forma dei dati della lega, rispecchia window.LEAGUE / window.BACHECA del sito originale.
// I salari/opzioni sono array a 5 elementi allineati alla finestra di 5 stagioni.

export type Opt = '' | 'T' | 'P' | 'NG' | string;

export interface Pick {
  y: number;      // anno del draft
  rd: number;     // giro (1/2/3)
  from: string;   // provenienza (testo libero storico)
}

export interface Team {
  sheet: string;
  name: string;
  gm: string;
  city: string;
  franchise: string;
  nomina: string;
  scadenza: string;
  picks: Pick[];
}

export interface Dead {
  t: string;        // squadra che ha tagliato (a cui resta il dead money)
  sal: number[];    // 5 stagioni
}

export interface Player {
  n: string;              // nome
  t: string;              // squadra (vuoto = free agent)
  r?: string;             // ruolo (G/GF/F/FC/C)
  s: string;              // stato: ATTIVO / TAGLIATO / ...
  sal: number[];          // 5 stagioni
  opt: Opt[];             // 5 stagioni
  pnd?: number[];         // rinnovi proposti (5 stagioni)
  dead?: Dead;            // penale da taglio con rifirma altrove
  [k: string]: unknown;   // campi extra tollerati
}

export interface League {
  league: string;
  cap: number;
  caps?: number[];
  seasons: string[];
  teams: Team[];
  players: Player[];
  [k: string]: unknown;
}

// window.BACHECA — tenuto come blob opaco, la forma completa vive nel client SPA.
export type Bacheca = Record<string, unknown>;

export interface LeagueState {
  data: League;
  bacheca: Bacheca;
  updated_at?: string;
  updated_by?: string | null;
}
