export type Year = 3 | 4 | 5;

export type SlotCode =
  | 'PS_ALTI_M'
  | 'PS_ALTI_P'
  /** PS autonomo del V anno: mattina e pomeriggio, tutti i giorni. */
  | 'PS_AUTO_M'
  | 'PS_AUTO_P'
  | 'PS_VERDI_M'
  | 'PS_VERDI_P'
  | 'PS_NOTTE'
  | 'OBI_M'
  | 'OBI_P'
  | 'PEDU_M'
  | 'PEDU_P'
  | 'BAMBI'
  | 'AMB'
  /** Reparti facoltativi (lun–ven, tutto il giorno): V o IV anno, solo a mano, fuori dal bilanciamento. */
  | 'ORTO'
  | 'RADIO'
  | 'ANEST'
  | 'CHIR';

/** Famiglia di turno usata per il bilanciamento e la panoramica. */
export type Family = 'PS_ALTI' | 'PS_AUTO' | 'PS_VERDI' | 'PS_NOTTE' | 'OBI' | 'PEDU' | 'AMB' | 'BAMBI' | 'ORTO' | 'RADIO' | 'ANEST' | 'CHIR';

export type Fascia = 'M' | 'P' | 'N';

export type AbsenceKind = 'X' | 'F' | 'noM' | 'noP' | 'noN' | 'soloM' | 'soloP' | 'soloN';

/** Fasce escluse da ogni tipo di indisponibilità. */
export const ABSENCE_BLOCKS: Record<AbsenceKind, Fascia[]> = {
  X: ['M', 'P', 'N'],
  F: ['M', 'P', 'N'],
  noM: ['M'],
  noP: ['P'],
  noN: ['N'],
  soloM: ['P', 'N'],
  soloP: ['M', 'N'],
  soloN: ['M', 'P'],
};

/** Etichetta breve (griglia) e descrizione (menu, avvisi) di ogni tipo. */
export const ABSENCE_INFO: Record<AbsenceKind, { short: string; label: string }> = {
  X: { short: 'X', label: 'indisponibile' },
  F: { short: 'F', label: 'ferie' },
  noM: { short: 'no M', label: 'no mattina' },
  noP: { short: 'no P', label: 'no pomeriggio' },
  noN: { short: 'no N', label: 'no notte' },
  soloM: { short: 'solo M', label: 'solo mattina' },
  soloP: { short: 'solo P', label: 'solo pomeriggio' },
  soloN: { short: 'solo N', label: 'solo notte' },
};

/**
 * Limiti alle indisponibilità (solo X, giorno intero) per persona e mese, e giorno del mese precedente entro cui
 * comunicarle. Superarli dà un avviso, non un blocco.
 */
export const ABSENCE_LIMITS = { weekendX: 4, weekdayX: 8, deadlineDay: 15 } as const;

/** Etichetta generica: persone a caso, non in anagrafica. */
export const RUOTA = 'RUOTA_COMUNE';

/** Prefisso di un nome scritto a mano che non è in anagrafica (es. un esterno): si mostra ma non si conta. */
export const EXTERNAL = 'EXT:';

/** Persona dell'anagrafica (non la ruota comune né un nome esterno): solo queste si contano e si controllano. */
export const isPerson = (who: string | undefined): who is string => !!who && who !== RUOTA && !who.startsWith(EXTERNAL);

export interface Person {
  id: string;
  name: string;
  bambiInterest: boolean;
  /** Eccezione personale: non riceve turni di OBI. */
  noObi?: boolean;
}

/** Una riga per persona per anno di specializzazione. */
export interface Enrollment {
  personId: string;
  academicYear: string; // es. "2026/27"
  year: Year;
  activeFrom: string; // YYYY-MM-DD
  activeTo?: string; // YYYY-MM-DD incluso
}

export interface AcademicYear {
  id: string; // "2026/27"
  start: string; // 2026-11-01
  end: string; // 2027-10-31
  vLastDay: string; // ultimo giorno del V anno, incluso (27 ottobre)
}

export interface Absence {
  personId: string;
  date: string;
  kind: AbsenceKind;
}

export interface ExamDay {
  date: string;
  years: Year[];
  /** true = solo la notte di quel giorno; false = tutto il giorno (notte compresa). */
  nightOnly: boolean;
}

export interface MonthParams {
  month: string; // YYYY-MM
  exams: ExamDay[];
}

export interface Assignment {
  date: string;
  slot: SlotCode;
  idx: number;
  who: string; // personId | RUOTA
  source: 'manual' | 'suggested';
}

/** Un posto da coprire in un giorno. */
export interface Position {
  date: string;
  slot: SlotCode;
  idx: number;
  /** Per i 12h del weekend (Ped Urg, PS del III anno): la stessa persona copre anche questi slot. */
  alsoSlots: SlotCode[];
  /** Preferenza: chi il giorno prima ha fatto questo slot (scambio alti/verdi del III anno nel weekend). */
  prevDaySlot?: SlotCode;
  /** Quanti giorni prima guardare per `prevDaySlot` (default 1; 2 = venerdì notte → domenica PS del V anno). */
  prevDays?: number;
  /** Giorni successivi dello stesso blocco (Ped Urg ven P → lun M): si preferisce chi è disponibile per tutti. */
  blockAhead?: SlotCode[][];
  /** Il blocco si decide prima del giro giorno per giorno, a chi ne ha fatti meno (Ped Urg ven → lun, OBI sab + dom). */
  planBlock?: boolean;
  /** Vincolo: non chi il giorno prima ha fatto questo stesso slot (V anno agli alti nel weekend). */
  notPrevDay?: boolean;
  /** Anni di corso che possono coprirlo secondo le regole. */
  years: Year[];
  /** Se nessuno è disponibile, si scrive "Ruota comune" (solo notti lun–ven). */
  ruotaFallback: boolean;
  /** Il motore non lo compila (Bambi): solo manuale, non conta come scoperto. */
  manualOnly: boolean;
  label: string;
}

export type History = Record<string, Partial<Record<Family, number>>>;

/**
 * Altri conteggi per il bilanciamento: giorni di weekend lavorati, blocchi Ped Urg (ven P → lun M) iniziati
 * e weekend di OBI (sab + dom) del V anno.
 */
export type ExtraHistory = Record<string, { weekend: number; blocks: number; obiWeekends?: number }>;

export interface EngineInput {
  month: string;
  people: Person[];
  enrollments: Enrollment[];
  academicYear: AcademicYear;
  absences: Absence[];
  params: MonthParams;
  /** Assegnazioni manuali del mese: il motore non le tocca. */
  locked: Assignment[];
  /** Conteggi dei mesi precedenti dello stesso anno di specializzazione. */
  history: History;
  /** Giorni di weekend e blocchi Ped Urg dei mesi precedenti dello stesso anno. */
  extraHistory?: ExtraHistory;
  /** Assegnazioni degli ultimi giorni del mese prima (per smonti). */
  previous?: Assignment[];
  runs?: number;
  seed?: number;
}

export interface Warning {
  date: string;
  slot?: SlotCode;
  idx?: number;
  personId?: string;
  level: 'error' | 'warn';
  message: string;
}

export interface EngineResult {
  assignments: Assignment[];
  holes: Position[];
  cost: number;
}
