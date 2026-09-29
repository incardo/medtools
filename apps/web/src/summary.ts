import { daysOfMonth, isWeekend, RUOTA, type Position, type SlotCode, type Year } from '@medtools/engine';
import { cellsToAssignments, type AppData } from './store';
import type { HeadNode } from './calendarHeaders';

/**
 * Colonne della panoramica (app ed Excel), per tipo di turno. In PS e OBI mattina e pomeriggio sono equivalenti:
 * si contano insieme, distinguendo solo alti e verdi. Un turno da 12h conta come due turni.
 */
export const SUMMARY_TURNS: { key: string; slots: SlotCode[] }[] = [
  { key: 'PS_ALTI', slots: ['PS_ALTI_M', 'PS_ALTI_P'] },
  { key: 'PS_VERDI', slots: ['PS_VERDI_M', 'PS_VERDI_P'] },
  { key: 'PS_NOTTE', slots: ['PS_NOTTE'] },
  { key: 'OBI', slots: ['OBI_M', 'OBI_P'] },
  { key: 'PEDU_M', slots: ['PEDU_M'] },
  { key: 'PEDU_P', slots: ['PEDU_P'] },
  { key: 'BAMBI', slots: ['BAMBI'] },
  { key: 'AMB', slots: ['AMB'] },
];

/** Colonne dopo i turni, nell'ordine dell'intestazione. */
export const SUMMARY_EXTRA = ['total', 'weekend', 'ferie', 'indisp', 'parziali'] as const;
export type SummaryExtra = (typeof SUMMARY_EXTRA)[number];

export const SUMMARY_HEADERS: HeadNode[] = [
  { label: 'PS', children: [{ label: 'Alti' }, { label: 'Verdi' }, { label: 'Notte' }] },
  { label: 'OBI' },
  { label: 'Ped Urg', children: [{ label: 'Mattina' }, { label: 'Pomeriggio' }] },
  { label: 'Bambi' },
  { label: 'Amb' },
  { label: 'Totale' },
  { label: 'Weekend' },
  { label: 'Assenze (giorni)', children: [{ label: 'Ferie' }, { label: 'Indisp.' }, { label: 'Parziali' }] },
];

export interface PersonSummary {
  slots: Partial<Record<SlotCode, number>>;
  /** Turni del periodo, Bambi escluso (non entra nel bilanciamento). */
  total: number;
  /** Giorni di sabato o domenica con almeno un turno. */
  weekend: number;
  ferie: number;
  indisp: number;
  parziali: number;
}

/** Conteggi per persona su uno o più mesi. La ruota comune non è conteggiata. */
export function summarize(data: AppData, months: string[]): Record<string, PersonSummary> {
  const out: Record<string, PersonSummary> = {};
  const get = (id: string) => (out[id] ??= { slots: {}, total: 0, weekend: 0, ferie: 0, indisp: 0, parziali: 0 });
  const weekendDays = new Map<string, Set<string>>();
  for (const m of months) {
    for (const a of cellsToAssignments(data.assignments[m])) {
      if (a.who === RUOTA) continue;
      const s = get(a.who);
      s.slots[a.slot] = (s.slots[a.slot] ?? 0) + 1;
      if (a.slot !== 'BAMBI') s.total++;
      if (isWeekend(a.date)) weekendDays.set(a.who, (weekendDays.get(a.who) ?? new Set()).add(a.date));
    }
    for (const p of data.people) {
      for (const d of daysOfMonth(m)) {
        const k = data.absences[`${p.id}|${d}`];
        if (!k) continue;
        const s = get(p.id);
        if (k === 'F') s.ferie++;
        else if (k === 'X') s.indisp++;
        else s.parziali++;
      }
    }
  }
  for (const [id, days] of weekendDays) get(id).weekend = days.size;
  return out;
}

export type SummaryCol = string;
export const SUMMARY_COLS: SummaryCol[] = [...SUMMARY_TURNS.map((t) => t.key), ...SUMMARY_EXTRA];
/** Slot contati in una colonna di turni; undefined per totale, weekend e assenze. */
export const turnSlots = (col: SummaryCol) => SUMMARY_TURNS.find((t) => t.key === col)?.slots;

export function summaryValue(s: PersonSummary | undefined, col: SummaryCol): number {
  if (!s) return 0;
  const slots = turnSlots(col);
  return slots ? slots.reduce((n, x) => n + (s.slots[x] ?? 0), 0) : s[col as SummaryExtra];
}

/** Turni che le regole prevedono per ogni anno di corso nel mese (Bambi escluso: dipende dall'interesse). */
export function slotsByYear(demand: Position[][]): Record<Year, Set<SlotCode>> {
  const out: Record<Year, Set<SlotCode>> = { 3: new Set(), 4: new Set(), 5: new Set() };
  for (const day of demand)
    for (const p of day) {
      if (p.manualOnly) continue;
      for (const y of p.years) for (const s of [p.slot, ...p.alsoSlots]) out[y].add(s);
    }
  return out;
}
