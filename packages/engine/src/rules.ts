import { isWeekend, weekday } from './dates';
import type { Fascia, Family, Position, SlotCode, Year } from './types';

export const SLOT_INFO: Record<SlotCode, { family: Family; fascia: Fascia; label: string; allDay?: boolean }> = {
  PS_ALTI_M: { family: 'PS_ALTI', fascia: 'M', label: 'PS alti M' },
  PS_ALTI_P: { family: 'PS_ALTI', fascia: 'P', label: 'PS alti P' },
  PS_AUTO_M: { family: 'PS_AUTO', fascia: 'M', label: 'PS autonomo M' },
  PS_AUTO_P: { family: 'PS_AUTO', fascia: 'P', label: 'PS autonomo P' },
  PS_VERDI_M: { family: 'PS_VERDI', fascia: 'M', label: 'PS verdi M' },
  PS_VERDI_P: { family: 'PS_VERDI', fascia: 'P', label: 'PS verdi P' },
  PS_NOTTE: { family: 'PS_NOTTE', fascia: 'N', label: 'Notte PS' },
  OBI_M: { family: 'OBI', fascia: 'M', label: 'OBI M' },
  OBI_P: { family: 'OBI', fascia: 'P', label: 'OBI P' },
  PEDU_M: { family: 'PEDU', fascia: 'M', label: 'Ped Urg M' },
  PEDU_P: { family: 'PEDU', fascia: 'P', label: 'Ped Urg P' },
  BAMBI: { family: 'BAMBI', fascia: 'M', label: 'Bambi' },
  AMB: { family: 'AMB', fascia: 'M', label: 'Ambulatorio' },
  ORTO: { family: 'ORTO', fascia: 'M', label: 'Ortopedia', allDay: true },
  RADIO: { family: 'RADIO', fascia: 'M', label: 'Radiologia', allDay: true },
  ANEST: { family: 'ANEST', fascia: 'M', label: 'Anestesia', allDay: true },
  CHIR: { family: 'CHIR', fascia: 'M', label: 'Chirurgia', allDay: true },
};

/** Fasce occupate da uno slot: i reparti facoltativi valgono tutto il giorno (mattina e pomeriggio). */
export const fasceOf = (slot: SlotCode): Fascia[] => (SLOT_INFO[slot].allDay ? ['M', 'P'] : [SLOT_INFO[slot].fascia]);

/** Reparti facoltativi (lun–ven): V o IV anno, solo a mano, fuori dal bilanciamento. */
export const OPTIONAL_WARDS: SlotCode[] = ['ORTO', 'RADIO', 'ANEST', 'CHIR'];

/** Turni che non entrano nel bilanciamento né nel totale. */
export const OUTSIDE_BALANCE: SlotCode[] = ['BAMBI', ...OPTIONAL_WARDS];

/** Colonne del calendario, nell'ordine del foglio. */
export const COLUMNS: { slot: SlotCode; idx: number }[] = [
  { slot: 'PS_ALTI_M', idx: 0 },
  { slot: 'PS_ALTI_M', idx: 1 },
  { slot: 'PS_AUTO_M', idx: 0 },
  { slot: 'PS_VERDI_M', idx: 0 },
  { slot: 'PS_ALTI_P', idx: 0 },
  { slot: 'PS_ALTI_P', idx: 1 },
  { slot: 'PS_AUTO_P', idx: 0 },
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
  { slot: 'ORTO', idx: 0 },
  { slot: 'RADIO', idx: 0 },
  { slot: 'ANEST', idx: 0 },
  { slot: 'CHIR', idx: 0 },
];

export const isPS = (slot: SlotCode) => slot.startsWith('PS_');

/** Vincoli per gruppo (sezione 5): chi NON può coprire uno slot, a prescindere dal giorno. */
export function yearCanCover(year: Year, slot: SlotCode): boolean {
  if (year === 3) return !['PEDU_P', 'OBI_M', 'OBI_P', ...OPTIONAL_WARDS].includes(slot);
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
 * PS feriale: per ogni giorno (1 = lunedì) e fascia, chi copre i posti alti, il posto verdi e l'autonomo.
 * Il venerdì mattina due alti al V anno (il III fa l'ambulatorio); il venerdì pomeriggio un solo alti (IV).
 */
const PS_FERIALE: Record<number, Record<'M' | 'P', { alti: Year[]; verdi: Year; auto: Year }>> = {
  1: { M: { alti: [5, 3], verdi: 4, auto: 5 }, P: { alti: [5, 4], verdi: 3, auto: 5 } },
  2: { M: { alti: [5, 4], verdi: 3, auto: 5 }, P: { alti: [5, 3], verdi: 4, auto: 5 } },
  3: { M: { alti: [5, 3], verdi: 4, auto: 5 }, P: { alti: [5, 4], verdi: 3, auto: 5 } },
  4: { M: { alti: [5, 4], verdi: 3, auto: 5 }, P: { alti: [5, 3], verdi: 4, auto: 5 } },
  5: { M: { alti: [5, 5], verdi: 4, auto: 5 }, P: { alti: [4], verdi: 3, auto: 5 } },
};

/**
 * Posti da coprire in un giorno, con chi li può coprire (sezioni 5–6 di CLAUDE.md).
 *
 * Senza V anno (fine ottobre) i suoi posti passano a IV e III anno; l'OBI solo al IV (il III non fa OBI).
 */
export function buildDemand(date: string, ctx: DemandContext): Position[] {
  const wd = weekday(date);
  const drafts: Draft[] = [];
  const v = ctx.vPresent;
  const V: Year[] = v ? [5] : [4, 3];
  const who = (y: Year): Year[] => (y === 5 ? V : [y]);

  if (isWeekend(date)) {
    const sunday = wd === 0;
    // V anno agli alti 12h. Chi fa il sabato fa la notte di domenica; la domenica tocca a chi ha fatto la notte di venerdì
    // (mai la stessa persona del sabato).
    drafts.push(
      sunday
        ? { slot: 'PS_ALTI_M', idx: 0, years: V, alsoSlots: ['PS_ALTI_P'], notPrevDay: true, ...(v && { prevDaySlot: 'PS_NOTTE', prevDays: 2 }) }
        : { slot: 'PS_ALTI_M', idx: 0, years: V, alsoSlots: ['PS_ALTI_P'], ...(v && { blockAhead: [['PS_NOTTE']] }) },
    );
    // III anno: uno agli alti e uno ai verdi, 12h ciascuno; la domenica si scambiano.
    drafts.push({ slot: 'PS_ALTI_M', idx: 1, years: [3], alsoSlots: ['PS_ALTI_P'], prevDaySlot: sunday ? 'PS_VERDI_M' : undefined });
    // Autonomo del V anno 12h.
    drafts.push({ slot: 'PS_AUTO_M', idx: 0, years: V, alsoSlots: ['PS_AUTO_P'] });
    drafts.push({ slot: 'PS_VERDI_M', idx: 0, years: [3], alsoSlots: ['PS_VERDI_P'], prevDaySlot: sunday ? 'PS_ALTI_M' : undefined });
    // Notte: un V anno (la domenica chi ha fatto gli alti il sabato) e un IV anno.
    drafts.push({ slot: 'PS_NOTTE', idx: 0, years: V, ...(v && sunday && { prevDaySlot: 'PS_ALTI_M' }) });
    drafts.push({ slot: 'PS_NOTTE', idx: 1, years: [4] });
    // OBI 12h: la stessa persona sabato e domenica (weekend di OBI, a rotazione tra i V anno).
    drafts.push(
      sunday
        ? { slot: 'OBI_M', idx: 0, years: V, alsoSlots: ['OBI_P'], prevDaySlot: 'OBI_M' }
        : { slot: 'OBI_M', idx: 0, years: V, alsoSlots: ['OBI_P'], blockAhead: [['OBI_M', 'OBI_P']], planBlock: true },
    );
    // Ped Urg 12h: una sola persona per mattina e pomeriggio
    // Blocco Ped Urg del IV anno: stessa persona da venerdì pomeriggio a lunedì mattina.
    drafts.push({ slot: 'PEDU_M', idx: 0, years: [4], alsoSlots: ['PEDU_P'], prevDaySlot: sunday ? 'PEDU_M' : 'PEDU_P' });
  } else {
    for (const f of ['M', 'P'] as const) {
      const { alti, verdi, auto } = PS_FERIALE[wd][f];
      alti.forEach((y, idx) => drafts.push({ slot: `PS_ALTI_${f}`, idx, years: who(y) }));
      drafts.push({ slot: `PS_AUTO_${f}`, idx: 0, years: who(auto) });
      drafts.push({ slot: `PS_VERDI_${f}`, idx: 0, years: who(verdi) });
    }
    // Notte: sempre un V anno. Chi fa la notte di venerdì fa la domenica gli alti 12h.
    drafts.push({ slot: 'PS_NOTTE', idx: 0, years: V, ...(v && wd === 5 && { blockAhead: [[], ['PS_ALTI_M', 'PS_ALTI_P']] }) });
    // Secondo posto di notte (lun–ven): ruota comune oppure un IV anno, solo a mano.
    // Se è uno specializzando conta come una notte, anche nel bilanciamento.
    drafts.push({ slot: 'PS_NOTTE', idx: 1, years: [4], manualOnly: true });
    drafts.push({ slot: 'OBI_M', idx: 0, years: V });
    drafts.push({ slot: 'OBI_P', idx: 0, years: V });
    drafts.push({ slot: 'PEDU_M', idx: 0, years: [4], prevDaySlot: wd === 1 ? 'PEDU_M' : undefined });
    drafts.push({ slot: 'PEDU_M', idx: 1, years: [3] });
    drafts.push({
      slot: 'PEDU_P',
      idx: 0,
      years: [4],
      ...(wd === 5 && { blockAhead: [['PEDU_M', 'PEDU_P'], ['PEDU_M', 'PEDU_P'], ['PEDU_M']], planBlock: true }),
    });
    // Ambulatorio solo giovedì e venerdì
    if (wd === 4 || wd === 5) drafts.push({ slot: 'AMB', idx: 0, years: [3] });
    // Reparti facoltativi: V o IV anno, a mano.
    for (const slot of OPTIONAL_WARDS) drafts.push({ slot, idx: 0, years: [5, 4], manualOnly: true });
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
