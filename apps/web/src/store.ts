import {
  SLOT_INFO,
  academicYearOf,
  addDays,
  countAssignments,
  countExtras,
  monthsOfAcademicYear,
  type AbsenceKind,
  type AcademicYear,
  type Assignment,
  type EngineInput,
  type Enrollment,
  type MonthParams,
  type Person,
  type SlotCode,
  type Year,
} from '@medtools/engine';

export interface Cell {
  who: string;
  source: 'manual' | 'suggested';
}

export interface AppData {
  version: 1;
  people: Person[];
  enrollments: Enrollment[];
  academicYears: AcademicYear[];
  /** chiave `${personId}|${date}` */
  absences: Record<string, AbsenceKind>;
  monthParams: Record<string, MonthParams>;
  /** mese → chiave `${date}|${slot}#${idx}` → cella */
  assignments: Record<string, Record<string, Cell>>;
  /** Notte PS: nomi della ruota comune scritti a mano, per data (fuori anagrafica e fuori bilanciamento). */
  ruotaNames?: Record<string, string>;
}

export const YEAR_LABEL: Record<Year, string> = { 3: 'III', 4: 'IV', 5: 'V' };

export const FIRST_YEAR: AcademicYear = { id: '2026/27', start: '2026-11-01', end: '2027-10-31', vLastDay: '2027-10-27' };

export function emptyData(): AppData {
  return { version: 1, people: [], enrollments: [], academicYears: [FIRST_YEAR], absences: {}, monthParams: {}, assignments: {}, ruotaNames: {} };
}

/** Composizione iniziale dell'anno 2026/27, da correggere a mano nella scheda Persone. */
export function initialComposition(): AppData {
  const groups: [Year, string[]][] = [
    [5, ['Alberti', 'Bassi', 'Caruso', 'De Luca', 'Esposito', 'Ferrari', 'Greco', 'Lombardi', 'Mancini', 'Moretti']],
    [4, ['Fontana', 'Galli', 'Longo', 'Marchetti', 'Negri', 'Orlando', 'Palumbo', 'Rinaldi']],
    [3, ['Pellegrini', 'Riva', 'Sala', 'Testa', 'Valentini', 'Zanetti']],
  ];
  const data = emptyData();
  for (const [year, names] of groups) {
    for (const name of names) {
      const id = name.toLowerCase().replace(/\W/g, '');
      data.people.push({ id, name, bambiInterest: false });
      data.enrollments.push({ personId: id, academicYear: FIRST_YEAR.id, year, activeFrom: FIRST_YEAR.start });
    }
  }
  return data;
}

/** Dati salvati in questo browser dalla versione precedente dell'app (prima dei dati condivisi). */
export function browserData(): AppData | null {
  try {
    const raw = localStorage.getItem('medtools:v1');
    return raw ? ({ ...emptyData(), ...(JSON.parse(raw) as AppData) } as AppData) : null;
  } catch {
    return null;
  }
}

export function paramsFor(data: AppData, month: string): MonthParams {
  return data.monthParams[month] ?? { month, exams: [] };
}

export function academicYearFor(data: AppData, month: string): AcademicYear {
  const id = academicYearOf(`${month}-01`);
  return (
    data.academicYears.find((a) => a.id === id) ?? {
      id,
      start: `${id.slice(0, 4)}-11-01`,
      end: `${Number(id.slice(0, 4)) + 1}-10-31`,
      vLastDay: `${Number(id.slice(0, 4)) + 1}-10-27`,
    }
  );
}

export function cellsToAssignments(cells: Record<string, Cell> | undefined): Assignment[] {
  return (
    Object.entries(cells ?? {})
      .filter(([, c]) => c.who)
      .map(([k, c]) => {
        const [date, rest] = k.split('|');
        const [slot, idx] = rest.split('#');
        return { date, slot: slot as SlotCode, idx: Number(idx), who: c.who, source: c.source };
      })
      // Colonne tolte dalle regole (es. alti opzionale): i dati restano nel database ma non si mostrano né si contano.
      .filter((a) => a.slot in SLOT_INFO)
  );
}

function prevMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

/** Input del motore per un mese: storico = mesi precedenti dello stesso anno (si azzera a novembre). */
export function engineInput(data: AppData, month: string): EngineInput {
  const ay = academicYearFor(data, month);
  const earlier = monthsOfAcademicYear(ay.id).filter((m) => m < month);
  const historyAssignments = earlier.flatMap((m) => cellsToAssignments(data.assignments[m]));
  const history = countAssignments(historyAssignments);
  const extraHistory = countExtras(historyAssignments);
  const firstDay = `${month}-01`;
  const previous = cellsToAssignments(data.assignments[prevMonth(month)]).filter((a) => a.date >= addDays(firstDay, -3));
  return {
    month,
    people: data.people,
    enrollments: data.enrollments,
    academicYear: ay,
    absences: Object.entries(data.absences).map(([k, kind]) => {
      const [personId, date] = k.split('|');
      return { personId, date, kind };
    }),
    params: paramsFor(data, month),
    locked: cellsToAssignments(data.assignments[month]).filter((a) => a.source === 'manual'),
    history,
    extraHistory,
    previous,
  };
}

export function newId(name: string): string {
  return `${name.toLowerCase().replace(/\W/g, '')}-${Math.random().toString(36).slice(2, 7)}`;
}
