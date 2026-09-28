import { isWeekend, weekIndex, weekday } from './dates';
import type { Fascia, Family, Position, SlotCode, Year } from './types';

export const SLOT_INFO: Record<SlotCode, { family: Family; fascia: Fascia; label: string }> = {
  PS_ALTI_M: { family: 'PS_ALTI', fascia: 'M', label: 'PS alti M' },
  PS_ALTI_P: { family: 'PS_ALTI', fascia: 'P', label: 'PS alti P' },
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
  { slot: 'PS_VERDI_M', idx: 0 },
  { slot: 'PS_ALTI_P', idx: 0 },
  { slot: 'PS_ALTI_P', idx: 1 },
  { slot: 'PS_VERDI_P', idx: 0 },
  { slot: 'PS_NOTTE', idx: 0 },
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
  vNightsPerPerson: number;
}

type Draft = Omit<Position, 'date' | 'alsoSlots' | 'ruotaFallback' | 'manualOnly' | 'label'> & Partial<Position>;

/**
 * Posti da coprire in un giorno, con chi li può coprire (sezioni 5–6 di CLAUDE.md).
 *
 * Assunzioni del prototipo:
 * - IV e III anno nei giorni feriali prendono fasce opposte (uno M, uno P) e la fascia si scambia ogni settimana.
 * - I posti PS feriali non assegnati a nessun anno sono facoltativi: si compilano a mano con chi è disponibile.
 * - OBI del V anno anche nel weekend; ambulatorio solo nei feriali.
 * - Ped Urg mattina del III anno tutti i giorni, weekend compreso.
 */
export function buildDemand(date: string, ctx: DemandContext): Position[] {
  const wd = weekday(date);
  const drafts: Draft[] = [];
  const V: Year[] = ctx.vPresent ? [5] : [4, 3];

  if (isWeekend(date)) {
    for (const f of ['M', 'P'] as const) {
      drafts.push({ slot: `PS_ALTI_${f}`, idx: 0, years: V });
      drafts.push({ slot: `PS_ALTI_${f}`, idx: 1, years: [3] });
      drafts.push({ slot: `PS_VERDI_${f}`, idx: 0, years: [3] });
    }
    // Nel weekend la ruota comune non copre le notti.
    drafts.push(
      wd === 6
        ? { slot: 'PS_NOTTE', idx: 0, years: [4] }
        : { slot: 'PS_NOTTE', idx: 0, years: V, monthlyCap: ctx.vPresent ? ctx.vNightsPerPerson : undefined },
    );
    drafts.push({ slot: 'OBI_M', idx: 0, years: V });
    drafts.push({ slot: 'OBI_P', idx: 0, years: V });
    // Ped Urg 12h: una sola persona per mattina e pomeriggio
    drafts.push({ slot: 'PEDU_M', idx: 0, years: [4], alsoSlots: ['PEDU_P'] });
    // Ped Urg mattina: anche un III anno insieme al IV
    drafts.push({ slot: 'PEDU_M', idx: 1, years: [3] });
  } else {
    // Alternanza IV / III: il IV prende una fascia, il III l'altra; si scambiano ogni settimana.
    const ivFascia = weekIndex(date) % 2 === 0 ? 'M' : 'P';
    const iiiFascia = ivFascia === 'M' ? 'P' : 'M';
    // Lun/Mer/Ven: IV ai codici alti, III ai verdi. Mar/Gio: il contrario.
    const ivAlti = wd === 1 || wd === 3 || wd === 5;
    const flex = new Map<string, Year>();
    flex.set(ivAlti ? `PS_ALTI_${ivFascia}` : `PS_VERDI_${ivFascia}`, 4);
    flex.set(ivAlti ? `PS_VERDI_${iiiFascia}` : `PS_ALTI_${iiiFascia}`, 3);

    // Posto senza anno assegnato: facoltativo, si compila a mano.
    const optional: Draft = { slot: 'PS_ALTI_M', idx: 0, years: [3, 4, 5], manualOnly: true, label: 'Posto facoltativo' };
    for (const f of ['M', 'P'] as const) {
      drafts.push({ slot: `PS_ALTI_${f}`, idx: 0, years: V });
      const alti = flex.get(`PS_ALTI_${f}`);
      drafts.push(alti ? { slot: `PS_ALTI_${f}`, idx: 1, years: [alti] } : { ...optional, slot: `PS_ALTI_${f}`, idx: 1 });
      const verdi = flex.get(`PS_VERDI_${f}`);
      drafts.push(verdi ? { slot: `PS_VERDI_${f}`, idx: 0, years: [verdi] } : { ...optional, slot: `PS_VERDI_${f}`, idx: 0 });
    }
    drafts.push(
      wd === 4
        ? { slot: 'PS_NOTTE', idx: 0, years: [4] }
        : { slot: 'PS_NOTTE', idx: 0, years: V, monthlyCap: ctx.vPresent ? ctx.vNightsPerPerson : undefined },
    );
    drafts.push({ slot: 'OBI_M', idx: 0, years: wd === 1 ? [4] : V });
    drafts.push({ slot: 'OBI_P', idx: 0, years: V });
    drafts.push({ slot: 'PEDU_M', idx: 0, years: [4] });
    drafts.push({ slot: 'PEDU_M', idx: 1, years: [3] });
    drafts.push({ slot: 'PEDU_P', idx: 0, years: [4] });
    drafts.push({ slot: 'AMB', idx: 0, years: [3] });
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
