import { addDays, isWeekend, weekday, weekendKey } from './dates';
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

/** Super festivi (mese-giorno): la notte di PS solo IV e V anno, senza ruota comune. */
export const SUPER_FESTIVI = ['12-24', '12-25', '12-26', '12-31', '01-01'];
export const isSuperFestivo = (date: string) => SUPER_FESTIVI.includes(date.slice(5));

/** Numero del weekend nel mese (1–5), contato dal sabato: la domenica appartiene al weekend del sabato prima. */
export const weekendNumber = (date: string) => Math.ceil(Number(weekendKey(date).slice(8)) / 7);

/** Chi copre un posto di notte: un anno di corso o la ruota comune ('R'). */
export type NightWho = Year | 'R';

/** Notti del weekend per numero di weekend nel mese: [posto 1, posto 2]. Il quinto weekend come il primo e il terzo. */
export const NIGHT_WEEKEND: Record<number, [NightWho, NightWho]> = {
  1: [5, 4],
  2: [4, 'R'],
  3: [5, 4],
  4: [5, 'R'],
  5: [5, 4],
};

/** I due posti di notte in PS: lun/mer/ven V + ruota comune, mar/gio V + IV, weekend secondo `NIGHT_WEEKEND`, super festivi V + IV. */
export function nightPlan(date: string): [NightWho, NightWho] {
  if (isSuperFestivo(date)) return [5, 4];
  if (isWeekend(date)) return NIGHT_WEEKEND[weekendNumber(date)];
  return weekday(date) % 2 === 0 ? [5, 4] : [5, 'R'];
}

/**
 * La ruota comune copre le notti: dove la regola la prevede, e come ripiego dal lunedì al venerdì.
 * Mai nei super festivi.
 */
export function ruotaCanCover(slot: SlotCode, date: string): boolean {
  if (slot !== 'PS_NOTTE' || isSuperFestivo(date)) return false;
  const wd = weekday(date);
  return (wd >= 1 && wd <= 5) || nightPlan(date).includes('R');
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

  const night = nightPlan(date);
  const nightYears = (w: NightWho): Year[] => (w === 'R' ? [] : who(w));
  const vNight = (d: string) => v && nightPlan(d)[0] === 5;

  if (isWeekend(date)) {
    const sunday = wd === 0;
    // V anno agli alti 12h. Chi fa il sabato fa la notte di domenica (se la domenica la notte è del V anno);
    // la domenica tocca a chi ha fatto la notte di venerdì (mai la stessa persona del sabato).
    drafts.push(
      sunday
        ? { slot: 'PS_ALTI_M', idx: 0, years: V, alsoSlots: ['PS_ALTI_P'], notPrevDay: true, ...(v && { prevDaySlot: 'PS_NOTTE', prevDays: 2 }) }
        : { slot: 'PS_ALTI_M', idx: 0, years: V, alsoSlots: ['PS_ALTI_P'], ...(vNight(addDays(date, 1)) && { blockAhead: [['PS_NOTTE']] }) },
    );
    // III anno: uno agli alti e uno ai verdi, 12h ciascuno; la domenica si scambiano.
    drafts.push({ slot: 'PS_ALTI_M', idx: 1, years: [3], alsoSlots: ['PS_ALTI_P'], prevDaySlot: sunday ? 'PS_VERDI_M' : undefined });
    // L'autonomo nel weekend non c'è.
    drafts.push({ slot: 'PS_VERDI_M', idx: 0, years: [3], alsoSlots: ['PS_VERDI_P'], prevDaySlot: sunday ? 'PS_ALTI_M' : undefined });
    // Notte: secondo il numero del weekend nel mese (V + IV, IV + ruota comune, V + ruota comune).
    // La domenica il V anno della notte è chi ha fatto gli alti il sabato.
    drafts.push({ slot: 'PS_NOTTE', idx: 0, years: nightYears(night[0]), ...(vNight(date) && sunday && { prevDaySlot: 'PS_ALTI_M' }) });
    drafts.push({ slot: 'PS_NOTTE', idx: 1, years: nightYears(night[1]) });
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
    // Notte: un V anno (chi fa la notte di venerdì fa la domenica gli alti 12h) e, secondo il giorno,
    // la ruota comune (lun/mer/ven) o un IV anno (mar/gio, super festivi).
    // Il IV anno di notte conta come una notte, anche nel bilanciamento.
    drafts.push({ slot: 'PS_NOTTE', idx: 0, years: nightYears(night[0]), ...(v && wd === 5 && { blockAhead: [[], ['PS_ALTI_M', 'PS_ALTI_P']] }) });
    drafts.push({ slot: 'PS_NOTTE', idx: 1, years: nightYears(night[1]) });
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
    // Se nessuno è disponibile, "Ruota comune" dove può coprire (notti). Un posto senza anni è della ruota comune.
    ruotaFallback: ruotaCanCover(d.slot, date),
    manualOnly: false,
    label: SLOT_INFO[d.slot].label,
    ...d,
    years: d.years.filter((y) => yearCanCover(y, d.slot)),
  }));
}
