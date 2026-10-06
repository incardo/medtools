const DAY_MS = 86_400_000;

function toUtc(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

// Il motore chiama queste funzioni centinaia di migliaia di volte sugli stessi pochi giorni: si memorizzano.
const addCache = new Map<string, Map<number, string>>();
const weekdayCache = new Map<string, number>();

export function addDays(date: string, n: number): string {
  let byN = addCache.get(date);
  if (!byN) addCache.set(date, (byN = new Map()));
  let out = byN.get(n);
  if (out === undefined) byN.set(n, (out = fromUtc(toUtc(date) + n * DAY_MS)));
  return out;
}

/** 0 = domenica … 6 = sabato */
export function weekday(date: string): number {
  let out = weekdayCache.get(date);
  if (out === undefined) weekdayCache.set(date, (out = new Date(toUtc(date)).getUTCDay()));
  return out;
}

export function isWeekend(date: string): boolean {
  const w = weekday(date);
  return w === 0 || w === 6;
}

/** Il weekend di un sabato o di una domenica, indicato dalla data del sabato. */
export function weekendKey(date: string): string {
  return weekday(date) === 0 ? addDays(date, -1) : date;
}

/** Weekend distinti (anche una sola giornata) tra i giorni dati. */
export function countWeekends(days: Iterable<string>): number {
  const keys = new Set<string>();
  for (const d of days) if (isWeekend(d)) keys.add(weekendKey(d));
  return keys.size;
}

export function daysOfMonth(month: string): string[] {
  const [y, m] = month.split('-').map(Number);
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
}

/** Indice della settimana (lunedì–domenica) dall'epoca: serve per alternare M/P. */
export function weekIndex(date: string): number {
  // 1970-01-05 era un lunedì
  return Math.floor((toUtc(date) - Date.UTC(1970, 0, 5)) / (7 * DAY_MS));
}

/** L'anno di specializzazione va da novembre a ottobre. */
export function academicYearOf(date: string): string {
  const [y, m] = date.split('-').map(Number);
  const start = m >= 11 ? y : y - 1;
  return `${start}/${String((start + 1) % 100).padStart(2, '0')}`;
}

/** Mesi di un anno di specializzazione, da novembre a ottobre. */
export function monthsOfAcademicYear(id: string): string[] {
  const start = Number(id.slice(0, 4));
  const out: string[] = [];
  for (let i = 0; i < 12; i++) {
    const m = ((10 + i) % 12) + 1;
    const y = m >= 11 ? start : start + 1;
    out.push(`${y}-${String(m).padStart(2, '0')}`);
  }
  return out;
}
