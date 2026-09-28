import { addDays, daysOfMonth, weekday } from './dates';
import { Roster } from './roster';
import { SLOT_INFO, buildDemand, isPS, ruotaCanCover, yearCanCover } from './rules';
import type { Assignment, EngineInput, EngineResult, Family, History, Position, SlotCode, Warning } from './types';
import { RUOTA } from './types';

const BALANCED: Family[] = ['PS_ALTI', 'PS_VERDI', 'PS_NOTTE', 'OBI', 'PEDU', 'AMB'];

export const keyOf = (a: { date: string; slot: SlotCode; idx: number }) => `${a.date}|${a.slot}#${a.idx}`;

export function makeRoster(input: EngineInput): Roster {
  return new Roster(input.people, input.enrollments, input.academicYear, input.absences, input.params.exams);
}

export function demandForMonth(input: EngineInput, roster = makeRoster(input)): Position[][] {
  return daysOfMonth(input.month).map((date) =>
    buildDemand(date, { vPresent: roster.vPresent(date), vNightsPerPerson: input.params.vNightsPerPerson }),
  );
}

/** Chi lavora cosa, giorno per giorno (solo persone, non la ruota comune). */
class Board {
  private byDay = new Map<string, Map<string, SlotCode[]>>();

  add(a: Assignment) {
    if (a.who === RUOTA || !a.who) return;
    let day = this.byDay.get(a.date);
    if (!day) this.byDay.set(a.date, (day = new Map()));
    day.set(a.who, [...(day.get(a.who) ?? []), a.slot]);
  }

  slots(personId: string, date: string): SlotCode[] {
    return this.byDay.get(date)?.get(personId) ?? [];
  }

  /** Lavora in PS sia sabato sia domenica prima del lunedì `monday`. */
  psWholeWeekend(personId: string, monday: string): boolean {
    return [addDays(monday, -2), addDays(monday, -1)].every((d) => this.slots(personId, d).some(isPS));
  }

  /** Ped Urg 12h (M+P) sia sabato sia domenica prima del martedì `tuesday`. */
  pedu12hWeekend(personId: string, tuesday: string): boolean {
    return [addDays(tuesday, -3), addDays(tuesday, -2)].every((d) => {
      const s = this.slots(personId, d);
      return s.includes('PEDU_M') && s.includes('PEDU_P');
    });
  }

  /** Smonto del weekend (preferenza): lunedì per chi fa PS sab+dom, martedì per Ped Urg 12h sab+dom. */
  weekendRestDue(personId: string, date: string): boolean {
    const wd = weekday(date);
    if (wd === 1) return this.psWholeWeekend(personId, date);
    if (wd === 2) return this.pedu12hWeekend(personId, date);
    return false;
  }
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function countAssignments(assignments: Assignment[]): History {
  const h: History = {};
  for (const a of assignments) {
    if (!a.who || a.who === RUOTA) continue;
    const fam = SLOT_INFO[a.slot].family;
    const row = (h[a.who] ??= {});
    row[fam] = (row[fam] ?? 0) + 1;
  }
  return h;
}

function variance(xs: number[]): number {
  if (xs.length < 2) return 0;
  const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
  return xs.reduce((s, x) => s + (x - mean) ** 2, 0) / xs.length;
}

function runOnce(input: EngineInput, roster: Roster, demand: Position[][], rng: () => number) {
  const board = new Board();
  const lockedKeys = new Set<string>();
  for (const a of input.previous ?? []) board.add(a);
  for (const a of input.locked) {
    board.add(a);
    lockedKeys.add(keyOf(a));
  }

  const counts: Record<string, Record<Family, number>> = {};
  const countOf = (p: string) =>
    (counts[p] ??= { PS_ALTI: 0, PS_VERDI: 0, PS_NOTTE: 0, OBI: 0, PEDU: 0, AMB: 0, BAMBI: 0, ...input.history[p] });
  const totalOf = (p: string) => BALANCED.reduce((s, f) => s + countOf(p)[f], 0);
  const monthNights: Record<string, number> = {};
  const bump = (p: string, slot: SlotCode) => {
    countOf(p)[SLOT_INFO[slot].family]++;
    if (slot === 'PS_NOTTE') monthNights[p] = (monthNights[p] ?? 0) + 1;
  };
  for (const a of input.locked) if (a.who && a.who !== RUOTA) bump(a.who, a.slot);

  const out: Assignment[] = [];
  const holes: Position[] = [];

  const canTake = (p: string, pos: Position): boolean => {
    const year = roster.yearOf(p, pos.date);
    if (!year || !pos.years.includes(year)) return false;
    const slots = [pos.slot, ...pos.alsoSlots];
    if (roster.unavailableForSlots(p, pos.date, slots)) return false;
    if (board.slots(p, pos.date).length) return false;
    if (board.slots(p, addDays(pos.date, -1)).includes('PS_NOTTE')) return false;
    if (pos.slot === 'PS_NOTTE' && board.slots(p, addDays(pos.date, 1)).length) return false;
    if (pos.notPrevDay && board.slots(p, addDays(pos.date, -1)).includes(pos.slot)) return false;
    if (pos.monthlyCap !== undefined && (monthNights[p] ?? 0) >= pos.monthlyCap) return false;
    return true;
  };

  const score = (p: string, pos: Position): number => {
    let s = countOf(p)[SLOT_INFO[pos.slot].family] * 3 + totalOf(p);
    if (board.weekendRestDue(p, pos.date)) s += 8;
    // Blocco Ped Urg: meglio chi è disponibile anche nei giorni successivi del blocco.
    pos.blockAhead?.forEach((slots, i) => {
      if (roster.unavailableForSlots(p, addDays(pos.date, i + 1), slots)) s += 10;
    });
    return s + rng() * 1.5;
  };

  for (const day of demand) {
    const open = day.filter(
      (pos) => !pos.manualOnly && ![pos.slot, ...pos.alsoSlots].some((s) => lockedKeys.has(keyOf({ ...pos, slot: s }))),
    );
    // Chi il giorno prima faceva il posto collegato (blocco Ped Urg, scambio del weekend).
    const linkedOf = (pos: Position, cands: string[]) => {
      const prev = pos.prevDaySlot;
      return prev ? cands.filter((p) => board.slots(p, addDays(pos.date, -1)).includes(prev)) : [];
    };
    // Prima i posti che continuano un blocco del giorno prima, poi quelli con meno candidati
    // (evita di bruciare le persone scarse).
    let pending = open;
    while (pending.length) {
      const people = roster.activeOn(pending[0].date).map((x) => x.person.id);
      let best: { pos: Position; cands: string[]; linked: string[] } | null = null;
      for (const pos of pending) {
        const cands = people.filter((p) => canTake(p, pos));
        const linked = linkedOf(pos, cands);
        const better =
          !best ||
          (linked.length > 0 && !best.linked.length) ||
          (linked.length > 0 === best.linked.length > 0 && cands.length < best.cands.length);
        if (better) best = { pos, cands, linked };
      }
      const { pos, cands, linked } = best!;
      pending = pending.filter((p) => p !== pos);

      if (cands.length) {
        const pool = linked.length ? linked : cands;
        const who = pool.reduce((a, b) => (score(a, pos) <= score(b, pos) ? a : b));
        for (const slot of [pos.slot, ...pos.alsoSlots]) {
          const a: Assignment = { date: pos.date, slot, idx: pos.idx, who, source: 'suggested' };
          out.push(a);
          board.add(a);
          bump(who, slot);
        }
      } else if (pos.ruotaFallback) {
        out.push({ date: pos.date, slot: pos.slot, idx: pos.idx, who: RUOTA, source: 'suggested' });
      } else {
        holes.push(pos);
      }
    }
  }

  // Costo: buchi, smonti del weekend non rispettati, blocchi spezzati, squilibrio dentro ogni anno di corso.
  let restViolations = 0;
  for (const a of out) if (a.who !== RUOTA && board.weekendRestDue(a.who, a.date)) restViolations++;
  const byKey = new Map(out.map((a) => [keyOf(a), a.who]));
  let brokenLinks = 0;
  for (const day of demand) {
    for (const pos of day) {
      const who = byKey.get(keyOf(pos));
      if (pos.prevDaySlot && who && who !== RUOTA && !board.slots(who, addDays(pos.date, -1)).includes(pos.prevDaySlot)) brokenLinks++;
    }
  }
  let spread = 0;
  const lastDay = demand[demand.length - 1][0].date;
  for (const year of [3, 4, 5]) {
    const ids = roster.activeOn(lastDay).filter((x) => x.year === year).map((x) => x.person.id);
    spread += variance(ids.map(totalOf)) * 2;
    for (const f of BALANCED) spread += variance(ids.map((p) => countOf(p)[f]));
  }
  return { assignments: out, holes, cost: holes.length * 1000 + restViolations * 15 + brokenLinks * 20 + spread };
}

/**
 * Genera i suggerimenti del mese. Prova più volte con pareggi rotti a caso e tiene il risultato migliore:
 * meno buchi, più smonti rispettati, carichi più equilibrati.
 */
export function suggestMonth(input: EngineInput): EngineResult {
  const roster = makeRoster(input);
  const demand = demandForMonth(input, roster);
  const rng = mulberry32(input.seed ?? 12345);
  let best: EngineResult | null = null;
  for (let i = 0; i < (input.runs ?? 60); i++) {
    const r = runOnce(input, roster, demand, rng);
    if (!best || r.cost < best.cost) best = r;
  }
  return best!;
}

/** Avvisi sul calendario (anche per le modifiche manuali). */
export function validate(input: EngineInput, assignments: Assignment[]): Warning[] {
  const roster = makeRoster(input);
  const demand = demandForMonth(input, roster);
  const board = new Board();
  for (const a of input.previous ?? []) board.add(a);
  for (const a of assignments) board.add(a);
  const byKey = new Map(assignments.map((a) => [keyOf(a), a]));
  // Turni da 12h ammessi per giorno (Ped Urg e PS del III anno nel weekend).
  const twelveHours = new Map(
    demand.map((day) => [
      day[0].date,
      day.filter((p) => p.alsoSlots.length).map((p) => [p.slot, ...p.alsoSlots].map((s) => `${s}#${p.idx}`).sort().join()),
    ]),
  );
  const byPersonDay = new Map<string, string[]>();
  for (const a of assignments) {
    const k = `${a.who}|${a.date}`;
    byPersonDay.set(k, [...(byPersonDay.get(k) ?? []), `${a.slot}#${a.idx}`]);
  }
  const out: Warning[] = [];

  for (const a of assignments) {
    if (!a.who) continue;
    const w = (level: Warning['level'], message: string) =>
      out.push({ date: a.date, slot: a.slot, idx: a.idx, personId: a.who, level, message });
    if (a.who === RUOTA) {
      if (!ruotaCanCover(a.slot, a.date)) w('error', 'La ruota comune copre solo le notti dal lunedì al venerdì');
      continue;
    }
    const year = roster.yearOf(a.who, a.date);
    if (!year) {
      w('error', 'Persona non attiva in questa data');
      continue;
    }
    if (!yearCanCover(year, a.slot)) w('error', `Il ${['', '', '', 'III', 'IV', 'V'][year]} anno non può coprire questo turno`);
    const why = roster.unavailable(a.who, a.date, SLOT_INFO[a.slot].fascia);
    if (why) w('error', `Non disponibile (${why})`);
    const same = board.slots(a.who, a.date);
    const mine = [...(byPersonDay.get(`${a.who}|${a.date}`) ?? [])].sort().join();
    const twelveH = twelveHours.get(a.date)?.includes(mine) ?? false;
    if (same.length > 1 && !twelveH) w('error', 'Più turni nello stesso giorno');
    if (board.slots(a.who, addDays(a.date, -1)).includes('PS_NOTTE')) w('error', 'Smonto notte non rispettato');
    if (board.weekendRestDue(a.who, a.date)) w('warn', 'Smonto dopo il weekend non rispettato');
  }

  for (const day of demand) {
    for (const pos of day) {
      const who = byKey.get(keyOf(pos))?.who;
      if (pos.notPrevDay && who && who !== RUOTA && board.slots(who, addDays(pos.date, -1)).includes(pos.slot)) {
        out.push({ date: pos.date, slot: pos.slot, idx: pos.idx, personId: who, level: 'error', message: 'Stessa persona del giorno prima: la domenica cambia' });
      }
      // Turno da 12h: tutte le fasce alla stessa persona.
      for (const s of pos.alsoSlots) {
        const other = byKey.get(keyOf({ ...pos, slot: s }))?.who;
        if (who && other && other !== who) {
          for (const [slot, p] of [[pos.slot, who], [s, other]] as const) {
            out.push({ date: pos.date, slot, idx: pos.idx, personId: p, level: 'error', message: 'Turno da 12h: mattina e pomeriggio alla stessa persona' });
          }
        }
      }
      if (pos.manualOnly || who) continue;
      out.push({ date: pos.date, slot: pos.slot, idx: pos.idx, level: 'warn', message: 'Nessuno assegnato' });
    }
  }
  return out;
}

export { Roster };
