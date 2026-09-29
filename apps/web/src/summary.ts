import { daysOfMonth, isWeekend, RUOTA, type Position, type SlotCode, type Year } from '@medtools/engine';
import { cellsToAssignments, type AppData } from './store';
import type { HeadNode } from './calendarHeaders';

/**
 * Colonne della panoramica (app ed Excel): stesse voci del calendario, per fascia e tipo e non per singolo posto.
 * Un turno da 12h conta come due turni (mattina + pomeriggio).
 */
export const SUMMARY_SLOTS: SlotCode[] = [
  'PS_ALTI_M',
  'PS_VERDI_M',
  'PS_ALTI_P',
  'PS_VERDI_P',
  'PS_NOTTE',
  'OBI_M',
  'OBI_P',
  'PEDU_M',
  'PEDU_P',
  'BAMBI',
  'AMB',
];

/** Colonne dopo i turni, nell'ordine dell'intestazione. */
export const SUMMARY_EXTRA = ['total', 'weekend', 'ferie', 'indisp', 'parziali'] as const;
export type SummaryExtra = (typeof SUMMARY_EXTRA)[number];

const empty = (label = ''): HeadNode => ({ label, children: [{ label: '' }] });

export const SUMMARY_HEADERS: HeadNode[] = [
  {
    label: 'PS',
    children: [
      { label: 'Mattina', children: [{ label: 'Alti' }, { label: 'Verdi' }] },
      { label: 'Pomeriggio', children: [{ label: 'Alti' }, { label: 'Verdi' }] },
      empty('Notte'),
    ],
  },
  { label: 'OBI', children: [empty('Mattina'), empty('Pomeriggio')] },
  { label: 'Ped Urg', children: [empty('Mattina'), empty('Pomeriggio')] },
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

export type SummaryCol = SlotCode | SummaryExtra;
export const SUMMARY_COLS: SummaryCol[] = [...SUMMARY_SLOTS, ...SUMMARY_EXTRA];
const isSlot = (col: SummaryCol): col is SlotCode => (SUMMARY_SLOTS as string[]).includes(col);

export const summaryValue = (s: PersonSummary | undefined, col: SummaryCol): number =>
  !s ? 0 : isSlot(col) ? (s.slots[col] ?? 0) : s[col];

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
