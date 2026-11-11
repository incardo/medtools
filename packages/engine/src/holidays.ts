import { addDays, isWeekend, weekday } from './dates';

/**
 * Festivi nazionali italiani a data fissa (mese-giorno), più il 31 dicembre (scelto dal gruppo).
 * Il 4 ottobre (San Francesco) è festa nazionale dal 2026 (legge 151/2025). Niente santo patrono.
 */
const FIXED: Record<string, string> = {
  '01-01': 'Capodanno',
  '01-06': 'Epifania',
  '04-25': 'Festa della Liberazione',
  '05-01': 'Festa del Lavoro',
  '06-02': 'Festa della Repubblica',
  '08-15': 'Ferragosto',
  '10-04': 'San Francesco d’Assisi',
  '11-01': 'Ognissanti',
  '12-08': 'Immacolata Concezione',
  '12-25': 'Natale',
  '12-26': 'Santo Stefano',
  '12-31': 'San Silvestro',
};

const easterCache = new Map<number, string>();

/** Domenica di Pasqua (calendario gregoriano, algoritmo di Meeus/Jones/Butcher). */
export function easter(year: number): string {
  let out = easterCache.get(year);
  if (out) return out;
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  out = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  easterCache.set(year, out);
  return out;
}

const nameCache = new Map<string, string | null>();

/** Nome del festivo, o null se il giorno non è festivo. */
export function festivoName(date: string): string | null {
  let out = nameCache.get(date);
  if (out !== undefined) return out;
  const year = Number(date.slice(0, 4));
  const e = easter(year);
  out = FIXED[date.slice(5)] ?? (date === e ? 'Pasqua' : date === addDays(e, 1) ? 'Lunedì dell’Angelo (Pasquetta)' : null);
  nameCache.set(date, out);
  return out;
}

export const isFestivo = (date: string) => festivoName(date) !== null;

/**
 * Festivo infrasettimanale (lun–ven): di giorno segue lo schema del sabato (12h), con smonto il giorno dopo.
 * I festivi di sabato o domenica sono già weekend: non cambia niente.
 */
export const isFestivoFeriale = (date: string) => !isWeekend(date) && isFestivo(date);

/**
 * Giorni da tenere separati da un festivo infrasettimanale attaccato al weekend: chi lavora di giorno nel festivo
 * non lavora di giorno in quel weekend, e viceversa (persone diverse). Venerdì festivo → sab e dom dopo;
 * lunedì festivo → sab e dom prima; sabato o domenica → il venerdì o il lunedì festivo vicino.
 */
export function festivoWeekendPartners(date: string): string[] {
  const wd = weekday(date);
  if (isFestivoFeriale(date)) {
    if (wd === 5) return [addDays(date, 1), addDays(date, 2)];
    if (wd === 1) return [addDays(date, -2), addDays(date, -1)];
    return [];
  }
  if (wd !== 6 && wd !== 0) return [];
  const sat = wd === 6 ? date : addDays(date, -1);
  return [addDays(sat, -1), addDays(sat, 2)].filter(isFestivoFeriale);
}

/** Festivi tra due date incluse (YYYY-MM-DD), in ordine. */
export function festiviBetween(from: string, to: string): { date: string; name: string }[] {
  const out: { date: string; name: string }[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const name = festivoName(d);
    if (name) out.push({ date: d, name });
  }
  return out;
}
