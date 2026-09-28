const DAY_MS = 86_400_000;

function toUtc(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(date: string, n: number): string {
  return fromUtc(toUtc(date) + n * DAY_MS);
}

/** 0 = domenica … 6 = sabato */
export function weekday(date: string): number {
  return new Date(toUtc(date)).getUTCDay();
}

export function isWeekend(date: string): boolean {
  const w = weekday(date);
  return w === 0 || w === 6;
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
