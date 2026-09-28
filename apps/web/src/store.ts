import { useEffect, useState } from 'react';
import {
  academicYearOf,
  addDays,
  countAssignments,
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
  /** mese â†’ chiave `${date}|${slot}#${idx}` â†’ cella */
  assignments: Record<string, Record<string, Cell>>;
}

const STORAGE_KEY = 'medtools:v1';

export const YEAR_LABEL: Record<Year, string> = { 3: 'III', 4: 'IV', 5: 'V' };

/** Dati di esempio con nomi fittizi (anno 2026/27). */
export function seedData(): AppData {
  const groups: [Year, string[]][] = [
    [5, ['Alberti', 'Bassi', 'Caruso', 'De Luca', 'Esposito', 'Ferrari', 'Greco', 'Lombardi', 'Mancini', 'Moretti']],
    [4, ['Fontana', 'Galli', 'Longo', 'Marchetti', 'Negri', 'Orlando', 'Palumbo', 'Rinaldi']],
    [3, ['Pellegrini', 'Riva', 'Sala', 'Testa', 'Valentini', 'Zanetti']],
  ];
  const people: Person[] = [];
  const enrollments: Enrollment[] = [];
  for (const [year, names] of groups) {
    for (const name of names) {
      const id = name.toLowerCase().replace(/\W/g, '');
      people.push({ id, name, bambiInterest: name === 'Galli' || name === 'Sala' });
      enrollments.push({ personId: id, academicYear: '2026/27', year, activeFrom: '2026-11-01' });
    }
  }
  const absences: Record<string, AbsenceKind> = {
    'fontana|2026-11-09': 'F',
    'fontana|2026-11-10': 'F',
    'fontana|2026-11-11': 'F',
    'galli|2026-11-04': 'noM',
    'longo|2026-11-18': 'X',
    'alberti|2026-11-20': 'F',
    'alberti|2026-11-21': 'F',
    'riva|2026-11-12': 'noP',
    'testa|2026-11-25': 'X',
  };
  return {
    version: 1,
    people,
    enrollments,
    academicYears: [{ id: '2026/27', start: '2026-11-01', end: '2027-10-31', vLastDay: '2027-10-27' }],
    absences,
    monthParams: {},
    assignments: {},
  };
}

function load(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as AppData;
  } catch {
    /* storage non disponibile: si riparte dai dati di esempio */
  }
  return seedData();
}

export function useAppData() {
  const [data, setData] = useState<AppData>(load);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* ignora */
    }
  }, [data]);
  return [data, setData] as const;
}

export function paramsFor(data: AppData, month: string): MonthParams {
  return data.monthParams[month] ?? { month, exams: [], vNightsPerPerson: 5 };
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
  return Object.entries(cells ?? {})
    .filter(([, c]) => c.who)
    .map(([k, c]) => {
      const [date, rest] = k.split('|');
      const [slot, idx] = rest.split('#');
      return { date, slot: slot as SlotCode, idx: Number(idx), who: c.who, source: c.source };
    });
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
    previous,
    runs: 30,
  };
}

export function newId(name: string): string {
  return `${name.toLowerCase().replace(/\W/g, '')}-${Math.random().toString(36).slice(2, 7)}`;
}
