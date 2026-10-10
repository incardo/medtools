import { describe, expect, it } from 'vitest';
import {
  EXTERNAL,
  OPTIONAL_WARDS,
  OUTSIDE_BALANCE,
  RUOTA,
  academicYearOf,
  addDays,
  buildDemand,
  countAssignments,
  countExtras,
  countWeekends,
  daysOfMonth,
  isWeekend,
  keyOf,
  makeRoster,
  monthsOfAcademicYear,
  nightPlan,
  ruotaCanCover,
  weekendNumber,
  suggestMonth,
  validate,
  weekday,
  type Assignment,
} from '../src';
import { exampleInput } from './fixtures';

const YEARS = new Map(exampleInput().enrollments.map((e) => [e.personId, e.year as number]));
const yearOf = (id: string) => YEARS.get(id) ?? 0;

describe('date e anno di specializzazione', () => {
  it("l'anno va da novembre a ottobre", () => {
    expect(academicYearOf('2026-11-01')).toBe('2026/27');
    expect(academicYearOf('2027-10-31')).toBe('2026/27');
    expect(academicYearOf('2027-11-01')).toBe('2027/28');
    expect(monthsOfAcademicYear('2026/27')[0]).toBe('2026-11');
    expect(monthsOfAcademicYear('2026/27')[11]).toBe('2027-10');
  });
});

describe('regole per anno (domanda giornaliera)', () => {
  const ctx = { vPresent: true };

  it('notti feriali: lun/mer/ven V + ruota comune, mar/gio V + IV', () => {
    const week = Array.from({ length: 5 }, (_, i) => addDays('2026-11-02', i)); // lun → ven
    const night = (d: string, idx: number) => buildDemand(d, ctx).find((p) => p.slot === 'PS_NOTTE' && p.idx === idx)!;
    expect(week.map((d) => night(d, 0).years)).toEqual(week.map(() => [5]));
    expect(week.map((d) => night(d, 1).years)).toEqual([[], [4], [], [4], []]);
    expect(week.map((d) => night(d, 1).manualOnly)).toEqual(week.map(() => false));
  });

  it('notti del weekend: 1° e 3° weekend V + IV, 2° IV + ruota, 4° V + ruota, 5° come il 1°', () => {
    const nights = (d: string) => buildDemand(d, ctx).filter((p) => p.slot === 'PS_NOTTE').map((p) => p.years);
    // novembre 2026: sabati 7, 14, 21, 28; la domenica 1 appartiene al weekend di sabato 31 ottobre (5°).
    expect(weekendNumber('2026-11-01')).toBe(5);
    expect(nights('2026-11-01')).toEqual([[5], [4]]);
    for (const [sat, exp] of [['2026-11-07', [[5], [4]]], ['2026-11-14', [[4], []]], ['2026-11-21', [[5], [4]]], ['2026-11-28', [[5], []]]] as const) {
      expect(nights(sat)).toEqual(exp);
      expect(nights(addDays(sat, 1))).toEqual(exp);
    }
    // Senza V anno di notte la domenica non è collegata agli alti del sabato.
    expect(buildDemand('2026-11-15', ctx).find((p) => p.slot === 'PS_NOTTE')!.prevDaySlot).toBeUndefined();
    expect(buildDemand('2026-11-14', ctx).find((p) => p.slot === 'PS_ALTI_M' && p.idx === 0)!.blockAhead).toBeUndefined();
  });

  it('super festivi: la notte solo IV e V, senza ruota comune', () => {
    for (const d of ['2026-12-24', '2026-12-25', '2026-12-26', '2026-12-31', '2027-01-01']) {
      const n = buildDemand(d, ctx).filter((p) => p.slot === 'PS_NOTTE');
      expect(n.map((p) => p.years)).toEqual([[5], [4]]);
      expect(n.some((p) => p.ruotaFallback)).toBe(false);
      expect(ruotaCanCover('PS_NOTTE', d)).toBe(false);
    }
  });

  it('OBI mattina e pomeriggio sempre al V anno (anche il lunedì)', () => {
    for (const date of daysOfMonth('2026-11')) {
      for (const p of buildDemand(date, ctx).filter((x) => x.slot.startsWith('OBI'))) expect(p.years).toEqual([5]);
    }
  });

  it('feriali: schema PS per giorno (alti, verdi, autonomo)', () => {
    const years = (date: string, slot: string, idx = 0) => buildDemand(date, ctx).find((p) => p.slot === slot && p.idx === idx)?.years;
    const ps = (date: string, f: 'M' | 'P') => [years(date, `PS_ALTI_${f}`), years(date, `PS_ALTI_${f}`, 1), years(date, `PS_VERDI_${f}`), years(date, `PS_AUTO_${f}`)];
    // [alti, alti, verdi, autonomo]
    expect(ps('2026-11-02', 'M')).toEqual([[5], [3], [4], [5]]); // lun
    expect(ps('2026-11-02', 'P')).toEqual([[5], [4], [3], [5]]);
    expect(ps('2026-11-03', 'M')).toEqual([[5], [4], [3], [5]]); // mar
    expect(ps('2026-11-03', 'P')).toEqual([[5], [3], [4], [5]]);
    expect(ps('2026-11-04', 'M')).toEqual([[5], [3], [4], [5]]); // mer
    expect(ps('2026-11-04', 'P')).toEqual([[5], [4], [3], [5]]);
    expect(ps('2026-11-05', 'M')).toEqual([[5], [4], [3], [5]]); // gio
    expect(ps('2026-11-05', 'P')).toEqual([[5], [3], [4], [5]]);
    expect(ps('2026-11-06', 'M')).toEqual([[5], [5], [4], [5]]); // ven: 3 V anno
    expect(ps('2026-11-06', 'P')).toEqual([[4], undefined, [3], [5]]); // ven: un solo alti
  });

  it('ogni posto ha un anno (tranne Bambi e reparti facoltativi, a mano, e la ruota comune)', () => {
    for (const date of daysOfMonth('2026-11')) {
      const d = buildDemand(date, ctx);
      expect(d.filter((p) => p.manualOnly && !OUTSIDE_BALANCE.includes(p.slot))).toEqual([]);
      for (const p of d.filter((x) => !x.years.length)) expect([p.slot, p.idx, p.ruotaFallback]).toEqual(['PS_NOTTE', 1, true]);
    }
  });

  it('ambulatorio solo giovedì e venerdì', () => {
    for (const date of daysOfMonth('2026-11')) {
      const amb = buildDemand(date, ctx).some((p) => p.slot === 'AMB');
      expect(amb).toBe(weekday(date) === 4 || weekday(date) === 5);
    }
  });

  it('weekend: Ped Urg 12h a un IV anno, PS alti V + III, verdi III, niente autonomo; tutti 12h', () => {
    const d = buildDemand('2026-11-08', ctx); // domenica
    const pedu = d.find((p) => p.slot === 'PEDU_M')!;
    expect(pedu.alsoSlots).toEqual(['PEDU_P']);
    expect(d.find((p) => p.slot === 'PEDU_P')).toBeUndefined();
    const v = d.find((p) => p.slot === 'PS_ALTI_M' && p.idx === 0)!;
    expect([v.years, v.alsoSlots, v.notPrevDay, v.prevDaySlot, v.prevDays]).toEqual([[5], ['PS_ALTI_P'], true, 'PS_NOTTE', 2]);
    expect(d.some((p) => p.slot.startsWith('PS_AUTO'))).toBe(false);
    expect(d.find((p) => p.slot === 'PS_NOTTE' && p.idx === 0)!.prevDaySlot).toBe('PS_ALTI_M');
    expect(d.find((p) => p.slot === 'PS_ALTI_P')).toBeUndefined();
    const alti = d.find((p) => p.slot === 'PS_ALTI_M' && p.idx === 1)!;
    const verdi = d.find((p) => p.slot === 'PS_VERDI_M')!;
    expect([alti.years, alti.alsoSlots, alti.prevDaySlot]).toEqual([[3], ['PS_ALTI_P'], 'PS_VERDI_M']);
    expect([verdi.years, verdi.alsoSlots, verdi.prevDaySlot]).toEqual([[3], ['PS_VERDI_P'], 'PS_ALTI_M']);
    const sat = buildDemand('2026-11-07', ctx);
    expect(sat.some((p) => p.slot.startsWith('PS_') && (p.prevDaySlot || p.notPrevDay))).toBe(false);
    expect(sat.find((p) => p.slot === 'PS_ALTI_M' && p.idx === 0)!.alsoSlots).toEqual(['PS_ALTI_P']);
    expect(buildDemand('2026-11-06', ctx).find((p) => p.slot === 'PS_NOTTE' && p.idx === 0)!.blockAhead).toEqual([[], ['PS_ALTI_M', 'PS_ALTI_P']]); // ven
  });

  it('Ped Urg mattina: un IV e un III anno nei feriali, solo il IV nel weekend', () => {
    for (const date of daysOfMonth('2026-11')) {
      const pm = buildDemand(date, ctx).filter((p) => p.slot === 'PEDU_M');
      const we = weekday(date) === 0 || weekday(date) === 6;
      expect(pm.map((p) => p.years)).toEqual(we ? [[4]] : [[4], [3]]);
    }
  });

  it('Ped Urg: blocco del IV anno da venerdì pomeriggio a lunedì mattina', () => {
    const pos = (date: string, slot: string) => buildDemand(date, ctx).find((p) => p.slot === slot && p.idx === 0)!;
    expect(pos('2026-11-06', 'PEDU_P').blockAhead).toEqual([['PEDU_M', 'PEDU_P'], ['PEDU_M', 'PEDU_P'], ['PEDU_M']]); // ven
    expect(pos('2026-11-07', 'PEDU_M').prevDaySlot).toBe('PEDU_P'); // sab
    expect(pos('2026-11-08', 'PEDU_M').prevDaySlot).toBe('PEDU_M'); // dom
    expect(pos('2026-11-09', 'PEDU_M').prevDaySlot).toBe('PEDU_M'); // lun
    expect(pos('2026-11-10', 'PEDU_M').prevDaySlot).toBeUndefined(); // mar
    expect(pos('2026-11-05', 'PEDU_P').blockAhead).toBeUndefined(); // gio
  });

  it('OBI del V anno anche nel weekend: una sola persona per 12h, la stessa sabato e domenica', () => {
    const d = buildDemand('2026-11-08', ctx); // domenica
    const obi = d.find((p) => p.slot === 'OBI_M')!;
    expect([obi.years, obi.alsoSlots]).toEqual([[5], ['OBI_P']]);
    expect(d.find((p) => p.slot === 'OBI_P')).toBeUndefined();
    expect(obi.prevDaySlot).toBe('OBI_M');
    expect(buildDemand('2026-11-07', ctx).find((p) => p.slot === 'OBI_M')!.planBlock).toBe(true); // sab
    expect(buildDemand('2026-11-03', ctx).find((p) => p.slot === 'OBI_M')!.alsoSlots).toEqual([]); // mar: M e P separati
  });

  it('ruota comune: notti lun–ven (anche come ripiego) e notti del 2° e 4° weekend', () => {
    for (const date of daysOfMonth('2026-11')) {
      for (const p of buildDemand(date, ctx)) {
        const wd = weekday(date);
        const n = weekendNumber(date);
        expect(p.ruotaFallback).toBe(p.slot === 'PS_NOTTE' && ((wd >= 1 && wd <= 5) || n === 2 || n === 4));
      }
    }
  });

  it('senza V anno i suoi turni passano a IV e III, ma il III non fa OBI', () => {
    const d = buildDemand('2027-10-29', { vPresent: false }); // ven
    expect(d.find((p) => p.slot === 'PS_ALTI_M' && p.idx === 0)!.years).toEqual([4, 3]);
    expect(d.find((p) => p.slot === 'PS_AUTO_P')!.years).toEqual([4, 3]);
    expect(d.find((p) => p.slot === 'PS_NOTTE' && p.idx === 0)!.years).toEqual([4, 3]);
    expect(d.find((p) => p.slot === 'OBI_P')!.years).toEqual([4]);
  });
});

describe('motore', () => {
  const input = exampleInput();
  const res = suggestMonth(input);
  const byPersonDay = new Map<string, Assignment[]>();
  for (const a of res.assignments) {
    if (a.who === RUOTA) continue;
    const k = `${a.who}|${a.date}`;
    byPersonDay.set(k, [...(byPersonDay.get(k) ?? []), a]);
  }

  it('la ruota comune compare solo dove la regola la prevede (secondo posto di notte)', () => {
    const ruota = res.assignments.filter((x) => x.who === RUOTA);
    for (const a of ruota) expect([a.slot, a.idx, nightPlan(a.date)[1]]).toEqual(['PS_NOTTE', 1, 'R']);
    const expected = daysOfMonth('2026-11').filter((d) => nightPlan(d)[1] === 'R');
    expect(ruota.map((a) => a.date).sort()).toEqual(expected);
  });

  it('un solo turno al giorno (i 12h del weekend contano come uno)', () => {
    const pairs = [
      ['PEDU_M', 'PEDU_P'],
      ['PS_ALTI_M', 'PS_ALTI_P'],
      ['PS_VERDI_M', 'PS_VERDI_P'],
      ['PS_AUTO_M', 'PS_AUTO_P'],
      ['OBI_M', 'OBI_P'],
    ].map((x) => x.join());
    for (const list of byPersonDay.values()) {
      if (list.length === 1) continue;
      expect(pairs).toContain(list.map((a) => a.slot).sort().join());
      expect(weekday(list[0].date) === 0 || weekday(list[0].date) === 6).toBe(true);
    }
  });

  it('Ped Urg: stessa persona da venerdì pomeriggio a lunedì mattina, poi smonto il martedì', () => {
    const who = (date: string, slot: string) => res.assignments.find((a) => a.date === date && a.slot === slot && a.idx === 0)?.who;
    for (const fri of daysOfMonth('2026-11').filter((d) => weekday(d) === 5)) {
      const p = who(fri, 'PEDU_P');
      expect(yearOf(p!)).toBe(4);
      for (const i of [1, 2]) {
        expect(who(addDays(fri, i), 'PEDU_M')).toBe(p);
        expect(who(addDays(fri, i), 'PEDU_P')).toBe(p);
      }
      expect(who(addDays(fri, 3), 'PEDU_M')).toBe(p);
      expect(byPersonDay.get(`${p}|${addDays(fri, 4)}`)).toBeUndefined();
    }
  });

  it('weekend: il V anno fa gli alti 12h e la domenica cambia persona', () => {
    const who = (date: string, slot: string) => res.assignments.find((a) => a.date === date && a.slot === slot && a.idx === 0)?.who;
    for (const sun of daysOfMonth('2026-11').filter((d) => weekday(d) === 0 && d > '2026-11-01')) {
      const sat = addDays(sun, -1);
      for (const d of [sat, sun]) {
        expect(yearOf(who(d, 'PS_ALTI_M')!)).toBe(5);
        expect(who(d, 'PS_ALTI_P')).toBe(who(d, 'PS_ALTI_M'));
      }
      expect(who(sun, 'PS_ALTI_M')).not.toBe(who(sat, 'PS_ALTI_M'));
    }
  });

  it('weekend del V anno: notte di venerdì → domenica alti 12h; alti del sabato → notte di domenica', () => {
    const who = (date: string, slot: string, idx = 0) => res.assignments.find((a) => a.date === date && a.slot === slot && a.idx === idx)?.who;
    for (const sat of daysOfMonth('2026-11').filter((d) => weekday(d) === 6)) {
      const fri = addDays(sat, -1);
      const sun = addDays(sat, 1);
      expect(who(sun, 'PS_ALTI_M')).toBe(who(fri, 'PS_NOTTE'));
      const [first, second] = nightPlan(sat);
      if (first === 5) expect(who(sun, 'PS_NOTTE')).toBe(who(sat, 'PS_ALTI_M'));
      for (const d of [sat, sun]) {
        expect(yearOf(who(d, 'PS_NOTTE')!)).toBe(first);
        if (second === 'R') expect(who(d, 'PS_NOTTE', 1)).toBe(RUOTA);
        else expect(yearOf(who(d, 'PS_NOTTE', 1)!)).toBe(second);
      }
    }
  });

  it('OBI del weekend: stessa persona sabato e domenica, diversa ogni weekend, poi smonto il lunedì', () => {
    const who = (date: string, slot: string) => res.assignments.find((a) => a.date === date && a.slot === slot && a.idx === 0)?.who;
    const sats = daysOfMonth('2026-11').filter((d) => weekday(d) === 6);
    const obi = sats.map((sat) => who(sat, 'OBI_M'));
    for (const [i, sat] of sats.entries()) {
      expect(who(addDays(sat, 1), 'OBI_M')).toBe(obi[i]);
      expect(byPersonDay.get(`${obi[i]}|${addDays(sat, 2)}`)).toBeUndefined();
    }
    expect(new Set(obi).size).toBe(sats.length);
  });

  it('con lo storico i weekend di OBI vanno prima a chi non ne ha fatti', () => {
    const ids = input.enrollments.filter((e) => e.year === 5).map((e) => e.personId);
    const done = ids.slice(0, 9);
    const extraHistory = Object.fromEntries(done.map((id) => [id, { weekend: 0, blocks: 0, obiWeekends: 1 }]));
    const r = suggestMonth({ ...input, extraHistory });
    const obi = r.assignments.filter((a) => a.slot === 'OBI_M' && weekday(a.date) === 6).map((a) => a.who);
    expect(obi.some((id) => done.includes(id))).toBe(false);
  });

  it('il V anno può fare 12h il sabato e la notte di domenica', () => {
    for (const s of ['PS_ALTI', 'OBI'] as const) {
      const ws = validate(input, [
        { date: '2026-11-07', slot: `${s}_M`, idx: 0, who: 'alfa', source: 'manual' },
        { date: '2026-11-07', slot: `${s}_P`, idx: 0, who: 'alfa', source: 'manual' },
        { date: '2026-11-08', slot: 'PS_NOTTE', idx: 0, who: 'alfa', source: 'manual' },
      ]);
      expect(ws.filter((w) => w.personId)).toEqual([]);
    }
  });

  it('segnala un turno da 12h diviso tra due persone', () => {
    const ws = validate(input, [
      { date: '2026-11-07', slot: 'OBI_M', idx: 0, who: 'alfa', source: 'manual' },
      { date: '2026-11-07', slot: 'OBI_P', idx: 0, who: 'bravo', source: 'manual' },
    ]);
    const errs = ws.filter((w) => w.level === 'error').map((w) => [w.slot, w.personId]);
    expect(errs).toEqual([
      ['OBI_M', 'alfa'],
      ['OBI_P', 'bravo'],
    ]);
  });

  it('segnala il V anno uguale sabato e domenica agli alti', () => {
    const ws = validate(input, [
      { date: '2026-11-07', slot: 'PS_ALTI_M', idx: 0, who: 'alfa', source: 'manual' },
      { date: '2026-11-07', slot: 'PS_ALTI_P', idx: 0, who: 'alfa', source: 'manual' },
      { date: '2026-11-08', slot: 'PS_ALTI_M', idx: 0, who: 'alfa', source: 'manual' },
    ]);
    const errs = ws.filter((w) => w.level === 'error');
    expect(errs.map((w) => [w.date, w.message])).toEqual([['2026-11-08', 'Stessa persona del giorno prima: la domenica cambia']]);
  });

  it('weekend: i due III anno del PS si scambiano alti e verdi la domenica', () => {
    const who = (date: string, slot: string, idx: number) => res.assignments.find((a) => a.date === date && a.slot === slot && a.idx === idx)?.who;
    for (const sun of daysOfMonth('2026-11').filter((d) => weekday(d) === 0 && d > '2026-11-01')) {
      const sat = addDays(sun, -1);
      expect(who(sun, 'PS_ALTI_M', 1)).toBe(who(sat, 'PS_VERDI_M', 0));
      expect(who(sun, 'PS_VERDI_M', 0)).toBe(who(sat, 'PS_ALTI_M', 1));
    }
  });

  it('dopo la notte non si lavora il giorno dopo', () => {
    for (const a of res.assignments.filter((x) => x.slot === 'PS_NOTTE' && x.who !== RUOTA)) {
      expect(byPersonDay.get(`${a.who}|${addDays(a.date, 1)}`)).toBeUndefined();
    }
  });

  it('rispetta gli anni di corso e i vincoli del III anno', () => {
    for (const a of res.assignments) {
      if (a.who === RUOTA) continue;
      if (yearOf(a.who) === 3) expect(['PEDU_P', 'OBI_M', 'OBI_P']).not.toContain(a.slot);
      if (a.slot.startsWith('PEDU')) expect(yearOf(a.who)).toBe(a.slot === 'PEDU_M' && a.idx === 1 ? 3 : 4);
    }
  });

  it('le notti del V anno sono distribuite in modo bilanciato tra le persone del V anno', () => {
    const nights: Record<string, number> = {};
    for (const a of res.assignments) if (a.slot === 'PS_NOTTE' && yearOf(a.who) === 5) nights[a.who] = (nights[a.who] ?? 0) + 1;
    const values = Object.values(nights);
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(2);
  });

  it('rispetta le assenze', () => {
    const withAbsence = exampleInput({
      absences: [
        { personId: 'kilo', date: '2026-11-02', kind: 'F' },
        { personId: 'lima', date: '2026-11-02', kind: 'noM' },
      ],
    });
    const r = suggestMonth(withAbsence);
    const onDay = r.assignments.filter((a) => a.date === '2026-11-02');
    expect(onDay.some((a) => a.who === 'kilo')).toBe(false);
    expect(onDay.some((a) => a.who === 'lima' && a.slot.endsWith('_M'))).toBe(false);
  });

  it('rispetta no notte e le disponibilità a una sola fascia', () => {
    const inp = exampleInput({
      absences: [
        { personId: 'alfa', date: '2026-11-03', kind: 'noN' },
        { personId: 'bravo', date: '2026-11-03', kind: 'soloM' },
        { personId: 'charlie', date: '2026-11-03', kind: 'soloP' },
        { personId: 'delta', date: '2026-11-03', kind: 'soloN' },
      ],
    });
    const roster = makeRoster(inp);
    expect(roster.unavailable('alfa', '2026-11-03', 'N')).toBe('no notte');
    expect(roster.unavailable('alfa', '2026-11-03', 'M')).toBeNull();
    expect(roster.unavailable('bravo', '2026-11-03', 'M')).toBeNull();
    expect(roster.unavailable('bravo', '2026-11-03', 'P')).toBe('solo mattina');
    expect(roster.unavailable('charlie', '2026-11-03', 'M')).toBe('solo pomeriggio');
    expect(roster.unavailable('delta', '2026-11-03', 'P')).toBe('solo notte');
    expect(roster.unavailable('delta', '2026-11-03', 'N')).toBeNull();

    const onDay = suggestMonth(inp).assignments.filter((a) => a.date === '2026-11-03');
    const fascia = (s: string) => (s === 'PS_NOTTE' ? 'N' : s.endsWith('_P') ? 'P' : 'M');
    expect(onDay.some((a) => a.who === 'alfa' && fascia(a.slot) === 'N')).toBe(false);
    expect(onDay.some((a) => a.who === 'bravo' && fascia(a.slot) !== 'M')).toBe(false);
    expect(onDay.some((a) => a.who === 'charlie' && fascia(a.slot) !== 'P')).toBe(false);
    expect(onDay.some((a) => a.who === 'delta' && fascia(a.slot) !== 'N')).toBe(false);
  });

  it('non tocca le assegnazioni manuali', () => {
    const locked: Assignment = { date: '2026-11-03', slot: 'PEDU_M', idx: 0, who: 'kilo', source: 'manual' };
    const r = suggestMonth(exampleInput({ locked: [locked] }));
    expect(r.assignments.some((a) => keyOf(a) === keyOf(locked))).toBe(false);
    expect(r.assignments.some((a) => a.date === '2026-11-03' && a.who === 'kilo')).toBe(false);
  });

  it('chi entra a metà mese non è assegnato prima del suo ingresso', () => {
    const base = exampleInput();
    const r = suggestMonth({
      ...base,
      people: [...base.people, { id: 'zulu', name: 'Zulu', bambiInterest: false }],
      enrollments: [...base.enrollments, { personId: 'zulu', academicYear: '2026/27', year: 4, activeFrom: '2026-11-16' }],
    });
    const zulu = r.assignments.filter((a) => a.who === 'zulu');
    expect(zulu.length).toBeGreaterThan(0);
    expect(zulu.every((a) => a.date >= '2026-11-16')).toBe(true);
  });

  it('con 14 V, 8 IV e 6 III anno novembre non ha posti scoperti', () => {
    expect(res.holes).toEqual([]);
    // Nessuna ruota comune di ripiego: solo dove la regola la prevede.
    expect(res.assignments.some((a) => a.who === RUOTA && a.idx === 0)).toBe(false);
  });

  it("eccezione personale: chi è escluso dall'OBI non lo riceve", () => {
    const base = exampleInput();
    const out = ['alfa', 'bravo', 'charlie'];
    const people = base.people.map((p) => (out.includes(p.id) ? { ...p, noObi: true } : p));
    const r = suggestMonth({ ...base, people });
    expect(r.assignments.some((a) => a.slot.startsWith('OBI') && out.includes(a.who))).toBe(false);
    expect(r.holes).toEqual([]);
    const ws = validate({ ...base, people }, [{ date: '2026-11-04', slot: 'OBI_M', idx: 0, who: 'alfa', source: 'manual' }]);
    expect(ws.find((w) => w.personId === 'alfa')?.level).toBe('warn');
  });

  it('il calendario suggerito non ha errori di validazione', () => {
    const errors = validate(input, res.assignments).filter((w) => w.level === 'error');
    expect(errors).toEqual([]);
  });

  it('V anno: al massimo 2 weekend nel mese (anche una sola giornata conta)', () => {
    const ids = input.enrollments.filter((e) => e.year === 5).map((e) => e.personId);
    for (const id of ids) {
      expect(countWeekends(res.assignments.filter((a) => a.who === id && isWeekend(a.date)).map((a) => a.date))).toBeLessThanOrEqual(2);
    }
    // A mano oltre il tetto: avviso.
    const three: Assignment[] = ['2026-11-07', '2026-11-15', '2026-11-21'].map((date) => ({ date, slot: 'OBI_M', idx: 0, who: 'alfa', source: 'manual' }));
    const ws = validate(input, three).filter((w) => w.message.startsWith('Più di 2 weekend'));
    expect(ws.map((w) => [w.date, w.level])).toEqual([['2026-11-21', 'warn']]);
  });

  it('bilancia i giorni di weekend lavorati dentro ogni anno di corso', () => {
    for (const year of [5, 4, 3]) {
      const ids = input.enrollments.filter((e) => e.year === year).map((e) => e.personId);
      const days = ids.map((id) => new Set(res.assignments.filter((a) => a.who === id && isWeekend(a.date)).map((a) => a.date)).size);
      expect(Math.max(...days) - Math.min(...days)).toBeLessThanOrEqual(2);
    }
  });

  it('i blocchi Ped Urg del mese vanno a persone diverse e pesano sui Ped Urg feriali', () => {
    const starts = res.assignments.filter((a) => a.slot === 'PEDU_P' && weekday(a.date) === 5).map((a) => a.who);
    expect(starts.length).toBe(4); // novembre 2026: venerdì 6, 13, 20, 27
    expect(new Set(starts).size).toBe(4);
    const ids = input.enrollments.filter((e) => e.year === 4).map((e) => e.personId);
    const pedu = ids.map((id) => res.assignments.filter((a) => a.who === id && a.slot.startsWith('PEDU')).length);
    expect(Math.max(...pedu) - Math.min(...pedu)).toBeLessThanOrEqual(2);
  });

  it('con lo storico i blocchi Ped Urg vanno prima a chi non ne ha fatti', () => {
    const ids = input.enrollments.filter((e) => e.year === 4).map((e) => e.personId);
    const done = ids.slice(0, 4);
    const extraHistory = Object.fromEntries(done.map((id) => [id, { weekend: 0, blocks: 1 }]));
    const r = suggestMonth({ ...input, extraHistory });
    const starts = r.assignments.filter((a) => a.slot === 'PEDU_P' && weekday(a.date) === 5).map((a) => a.who);
    expect(starts.some((id) => done.includes(id))).toBe(false);
  });

  it('countExtras conta giorni di weekend e blocchi Ped Urg', () => {
    const x = countExtras([
      { date: '2026-11-06', slot: 'PEDU_P', idx: 0, who: 'kilo', source: 'suggested' },
      { date: '2026-11-07', slot: 'PEDU_M', idx: 0, who: 'kilo', source: 'suggested' },
      { date: '2026-11-07', slot: 'PEDU_P', idx: 0, who: 'kilo', source: 'suggested' },
      { date: '2026-11-08', slot: 'PS_NOTTE', idx: 0, who: 'alfa', source: 'suggested' },
      { date: '2026-11-09', slot: 'PS_NOTTE', idx: 0, who: RUOTA, source: 'suggested' },
    ]);
    expect(x.kilo).toEqual({ weekend: 1, blocks: 1, obiWeekends: 0 });
    expect(x.alfa).toEqual({ weekend: 1, blocks: 0, obiWeekends: 0 });
    expect(x[RUOTA]).toBeUndefined();
  });

  it('reparti facoltativi: lun–ven, V o IV anno, solo a mano, tutto il giorno', () => {
    const wards = (d: string) => buildDemand(d, { vPresent: true }).filter((p) => OPTIONAL_WARDS.includes(p.slot));
    expect(wards('2026-11-02').map((p) => [p.slot, p.years, p.manualOnly])).toEqual(OPTIONAL_WARDS.map((s) => [s, [5, 4], true]));
    expect(wards('2026-11-07')).toEqual([]); // sab
    expect(res.assignments.some((a) => OPTIONAL_WARDS.includes(a.slot))).toBe(false);
    // Chi è in reparto quel giorno non riceve altri turni; fuori dal bilanciamento.
    const extra: Assignment = { date: '2026-11-03', slot: 'ORTO', idx: 0, who: 'kilo', source: 'manual' };
    const r = suggestMonth(exampleInput({ locked: [extra] }));
    expect(r.assignments.some((a) => a.date === '2026-11-03' && a.who === 'kilo')).toBe(false);
    // Tutto il giorno: "no P" basta per l'avviso.
    const ws = validate(exampleInput({ absences: [{ personId: 'kilo', date: '2026-11-03', kind: 'noP' }] }), [extra]);
    expect(ws.some((w) => w.personId === 'kilo' && w.message.startsWith('Non disponibile'))).toBe(true);
  });

  it('notte, secondo posto: ruota comune (lun/mer/ven) o IV anno (mar/gio), che conta nel bilanciamento', () => {
    const second = (d: string) => buildDemand(d, { vPresent: true }).find((p) => p.slot === 'PS_NOTTE' && p.idx === 1);
    expect(second('2026-11-02')).toMatchObject({ manualOnly: false, ruotaFallback: true, years: [] }); // lun
    expect(second('2026-11-03')).toMatchObject({ manualOnly: false, ruotaFallback: true, years: [4] }); // mar
    expect(second('2026-11-07')).toMatchObject({ manualOnly: false, ruotaFallback: false, years: [4] }); // sab, 1° weekend
    for (const a of res.assignments.filter((x) => x.slot === 'PS_NOTTE' && x.idx === 1 && [2, 4].includes(weekday(x.date)))) expect(yearOf(a.who)).toBe(4);
    // Uno specializzando inserito a mano al posto della ruota: smonto il giorno dopo e la notte conta nello storico.
    const extra: Assignment = { date: '2026-11-02', slot: 'PS_NOTTE', idx: 1, who: 'kilo', source: 'manual' };
    const r = suggestMonth(exampleInput({ locked: [extra] }));
    expect(r.assignments.some((a) => a.who === 'kilo' && (a.date === '2026-11-02' || a.date === '2026-11-03'))).toBe(false);
    expect(countAssignments([extra]).kilo.PS_NOTTE).toBe(1);
    // Stessa persona nei due posti della stessa notte: errore.
    const ws = validate(input, [
      { date: '2026-11-03', slot: 'PS_NOTTE', idx: 0, who: 'alfa', source: 'manual' },
      { date: '2026-11-03', slot: 'PS_NOTTE', idx: 1, who: 'alfa', source: 'manual' },
    ]);
    expect(ws.some((w) => w.message === 'Più turni nello stesso giorno')).toBe(true);
  });

  it('segnala assenze e doppi turni nelle modifiche manuali', () => {
    const inp = exampleInput({ absences: [{ personId: 'alfa', date: '2026-11-04', kind: 'X' }] });
    const ws = validate(inp, [
      { date: '2026-11-04', slot: 'OBI_P', idx: 0, who: 'alfa', source: 'manual' },
      { date: '2026-11-04', slot: 'PS_ALTI_M', idx: 0, who: 'bravo', source: 'manual' },
      { date: '2026-11-04', slot: 'OBI_M', idx: 0, who: 'bravo', source: 'manual' },
      { date: '2026-11-04', slot: 'OBI_M', idx: 0, who: 'sierra', source: 'manual' },
    ]);
    const msgs = ws.filter((w) => w.level === 'error').map((w) => w.message);
    expect(msgs).toContain('Non disponibile (indisponibile)');
    expect(msgs).toContain('Più turni nello stesso giorno');
    // III anno in OBI scelto a mano (sostituzione): avviso, non errore.
    const iii = ws.find((w) => w.personId === 'sierra' && w.message.includes('III anno di norma non copre'));
    expect(iii?.level).toBe('warn');
  });

  it('i nomi esterni scritti a mano si mostrano ma non si contano', () => {
    const ext: Assignment = { date: '2026-11-04', slot: 'PS_ALTI_M', idx: 0, who: `${EXTERNAL}Rossi`, source: 'manual' };
    expect(countAssignments([ext])).toEqual({});
    expect(countExtras([ext])).toEqual({});
    expect(validate(exampleInput(), [ext]).filter((w) => w.personId === ext.who)).toEqual([]);
    const r = suggestMonth(exampleInput({ locked: [ext] }));
    expect(r.assignments.some((a) => keyOf(a) === keyOf(ext))).toBe(false);
  });
});
