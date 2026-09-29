import { isWeekend, weekday } from './dates';
import type { Fascia, Family, Position, SlotCode, Year } from './types';

export const SLOT_INFO: Record<SlotCode, { family: Family; fascia: Fascia; label: string }> = {
  PS_ALTI_M: { family: 'PS_ALTI', fascia: 'M', label: 'PS alti M' },
  PS_ALTI_P: { family: 'PS_ALTI', fascia: 'P', label: 'PS alti P' },
  PS_OPZ_M: { family: 'PS_OPZ', fascia: 'M', label: 'PS alti opz. M' },
  PS_OPZ_P: { family: 'PS_OPZ', fascia: 'P', label: 'PS alti opz. P' },
  PS_VERDI_M: { family: 'PS_VERDI', fascia: 'M', label: 'PS verdi M' },
  PS_VERDI_P: { family: 'PS_VERDI', fascia: 'P', label: 'PS verdi P' },
  PS_NOTTE: { family: 'PS_NOTTE', fascia: 'N', label: 'Notte PS' },
  OBI_M: { family: 'OBI', fascia: 'M', label: 'OBI M' },
  OBI_P: { family: 'OBI', fascia: 'P', label: 'OBI P' },
  PEDU_M: { family: 'PEDU', fascia: 'M', label: 'Ped Urg M' },
  PEDU_P: { family: 'PEDU', fascia: 'P', label: 'Ped Urg P' },
  BAMBI: { family: 'BAMBI', fascia: 'M', label: 'Bambi' },
  AMB: { family: 'AMB', fascia: 'M', label: 'Ambulatorio' },
};

/** Colonne del calendario, nell'ordine del foglio. */
export const COLUMNS: { slot: SlotCode; idx: number }[] = [
  { slot: 'PS_ALTI_M', idx: 0 },
  { slot: 'PS_ALTI_M', idx: 1 },
  { slot: 'PS_OPZ_M', idx: 0 },
  { slot: 'PS_VERDI_M', idx: 0 },
  { slot: 'PS_ALTI_P', idx: 0 },
  { slot: 'PS_ALTI_P', idx: 1 },
  { slot: 'PS_OPZ_P', idx: 0 },
  { slot: 'PS_VERDI_P', idx: 0 },
  { slot: 'PS_NOTTE', idx: 0 },
  { slot: 'PS_NOTTE', idx: 1 },
  { slot: 'OBI_M', idx: 0 },
  { slot: 'OBI_P', idx: 0 },
  { slot: 'PEDU_M', idx: 0 },
  { slot: 'PEDU_M', idx: 1 },
  { slot: 'PEDU_P', idx: 0 },
  { slot: 'BAMBI', idx: 0 },
  { slot: 'AMB', idx: 0 },
];

export const isPS = (slot: SlotCode) => slot.startsWith('PS_');

/** Vincoli per gruppo (sezione 5): chi NON può coprire uno slot, a prescindere dal giorno. */
export function yearCanCover(year: Year, slot: SlotCode): boolean {
  if (year === 3) return slot !== 'PEDU_P' && slot !== 'OBI_M' && slot !== 'OBI_P';
  return true;
}

/** La ruota comune copre solo le notti dal lunedì al venerdì. */
export function ruotaCanCover(slot: SlotCode, date: string): boolean {
  const wd = weekday(date);
  return slot === 'PS_NOTTE' && wd >= 1 && wd <= 5;
}

interface DemandContext {
  /** Il V anno c'è quel giorno (non oltre l'ultimo giorno dell'anno). */
  vPresent: boolean;
}

type Draft = Omit<Position, 'date' | 'alsoSlots' | 'ruotaFallback' | 'manualOnly' | 'label'> & Partial<Position>;

/**
 * PS feriale: per ogni giorno (1 = lunedì) e fascia, chi copre i due posti alti e il posto verdi.
 * Il V anno fa gli alti tranne lunedì e venerdì pomeriggio, quando fa i verdi.
 */
const PS_FERIALE: Record<number, Record<'M' | 'P', { alti: [Year, Year]; verdi: Year }>> = {
  1: { M: { alti: [5, 3], verdi: 4 }, P: { alti: [4, 3], verdi: 5 } },
  2: { M: { alti: [5, 4], verdi: 3 }, P: { alti: [5, 3], verdi: 4 } },
  3: { M: { alti: [5, 3], verdi: 4 }, P: { alti: [5, 4], verdi: 3 } },
  4: { M: { alti: [5, 4], verdi: 3 }, P: { alti: [5, 3], verdi: 4 } },
  5: { M: { alti: [5, 3], verdi: 4 }, P: { alti: [4, 3], verdi: 5 } },
};

/**
 * Posti da coprire in un giorno, con chi li può coprire (sezioni 5–6 di CLAUDE.md).
 *
 * Senza V anno (fine ottobre) i suoi posti passano a IV e III anno; l'OBI solo al IV (il III non fa OBI).
 */
export function buildDemand(date: string, ctx: DemandContext): Position[] {
  const wd = weekday(date);
  const drafts: Draft[] = [];
  const V: Year[] = ctx.vPresent ? [5] : [4, 3];
  const who = (y: Year): Year[] => (y === 5 ? V : [y]);

  if (isWeekend(date)) {
    const sunday = wd === 0;
    // V anno agli alti 12h; la domenica una persona diversa dal sabato.
    drafts.push({ slot: 'PS_ALTI_M', idx: 0, years: V, alsoSlots: ['PS_ALTI_P'], notPrevDay: sunday });
    // III anno: uno agli alti e uno ai verdi, 12h ciascuno; la domenica si scambiano.
    drafts.push({ slot: 'PS_ALTI_M', idx: 1, years: [3], alsoSlots: ['PS_ALTI_P'], prevDaySlot: sunday ? 'PS_VERDI_M' : undefined });
    drafts.push({ slot: 'PS_VERDI_M', idx: 0, years: [3], alsoSlots: ['PS_VERDI_P'], prevDaySlot: sunday ? 'PS_ALTI_M' : undefined });
    // Nel weekend la ruota comune non copre le notti.
    drafts.push(
      wd === 6
        ? { slot: 'PS_NOTTE', idx: 0, years: [4] }
        : { slot: 'PS_NOTTE', idx: 0, years: V },
    );
    // OBI 12h: una sola persona per mattina e pomeriggio
    drafts.push({ slot: 'OBI_M', idx: 0, years: V, alsoSlots: ['OBI_P'] });
    // Ped Urg 12h: una sola persona per mattina e pomeriggio
    // Blocco Ped Urg del IV anno: stessa persona da venerdì pomeriggio a lunedì mattina.
    drafts.push({ slot: 'PEDU_M', idx: 0, years: [4], alsoSlots: ['PEDU_P'], prevDaySlot: sunday ? 'PEDU_M' : 'PEDU_P' });
  } else {
    for (const f of ['M', 'P'] as const) {
      const { alti, verdi } = PS_FERIALE[wd][f];
      drafts.push({ slot: `PS_ALTI_${f}`, idx: 0, years: who(alti[0]) });
      drafts.push({ slot: `PS_ALTI_${f}`, idx: 1, years: who(alti[1]) });
      // Alti opzionale: chiunque, solo a mano, fuori dal bilanciamento.
      drafts.push({ slot: `PS_OPZ_${f}`, idx: 0, years: [5, 4, 3], manualOnly: true });
      drafts.push({ slot: `PS_VERDI_${f}`, idx: 0, years: who(verdi) });
    }
    drafts.push(
      wd === 4
        ? { slot: 'PS_NOTTE', idx: 0, years: [4] }
        : { slot: 'PS_NOTTE', idx: 0, years: V },
    );
    // Secondo posto di notte (lun–ven): ruota comune oppure un altro specializzando, solo a mano.
    // Se è uno specializzando conta come una notte, anche nel bilanciamento.
    drafts.push({ slot: 'PS_NOTTE', idx: 1, years: [5, 4, 3], manualOnly: true });
    drafts.push({ slot: 'OBI_M', idx: 0, years: wd === 1 ? [4] : V });
    drafts.push({ slot: 'OBI_P', idx: 0, years: V });
    drafts.push({ slot: 'PEDU_M', idx: 0, years: [4], prevDaySlot: wd === 1 ? 'PEDU_M' : undefined });
    drafts.push({ slot: 'PEDU_M', idx: 1, years: [3] });
    drafts.push({
      slot: 'PEDU_P',
      idx: 0,
      years: [4],
      blockAhead: wd === 5 ? [['PEDU_M', 'PEDU_P'], ['PEDU_M', 'PEDU_P'], ['PEDU_M']] : undefined,
    });
    // Ambulatorio solo giovedì e venerdì
    if (wd === 4 || wd === 5) drafts.push({ slot: 'AMB', idx: 0, years: [3] });
  }
  drafts.push({ slot: 'BAMBI', idx: 0, years: [3, 4, 5], manualOnly: true });

  return drafts.map((d) => ({
    date,
    alsoSlots: [],
    // Se nessuno è disponibile, "Ruota comune" dove può coprire (notti lun–ven).
    ruotaFallback: ruotaCanCover(d.slot, date),
    manualOnly: false,
    label: SLOT_INFO[d.slot].label,
    ...d,
    years: d.years.filter((y) => yearCanCover(y, d.slot)),
  }));
}
