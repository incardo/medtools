import { describe, expect, it } from 'vitest';
import {
  RUOTA,
  academicYearOf,
  addDays,
  buildDemand,
  daysOfMonth,
  keyOf,
  makeRoster,
  monthsOfAcademicYear,
  suggestMonth,
  validate,
  weekday,
  type Assignment,
} from '../src';
import { exampleInput } from './fixtures';

const yearOf = (id: string) => (id === RUOTA ? 0 : id[0] <= 'j' ? 5 : id[0] <= 'r' ? 4 : 3);

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
  const ctx = { vPresent: true, vNightsPerPerson: 5 };

  it('IV anno: notte giovedì e sabato, OBI mattina il lunedì', () => {
    expect(buildDemand('2026-11-05', ctx).find((p) => p.slot === 'PS_NOTTE')!.years).toEqual([4]); // gio
    expect(buildDemand('2026-11-07', ctx).find((p) => p.slot === 'PS_NOTTE')!.years).toEqual([4]); // sab
    expect(buildDemand('2026-11-02', ctx).find((p) => p.slot === 'OBI_M')!.years).toEqual([4]); // lun
    expect(buildDemand('2026-11-03', ctx).find((p) => p.slot === 'OBI_M')!.years).toEqual([5]); // mar
  });

  it('feriali: schema PS per giorno (V alti, tranne lun/ven pomeriggio ai verdi)', () => {
    const years = (date: string, slot: string, idx = 0) => buildDemand(date, ctx).find((p) => p.slot === slot && p.idx === idx)!.years;
    const ps = (date: string, f: 'M' | 'P') => [years(date, `PS_ALTI_${f}`), years(date, `PS_ALTI_${f}`, 1), years(date, `PS_VERDI_${f}`)];
    // [alti, alti, verdi]
    expect(ps('2026-11-02', 'M')).toEqual([[5], [3], [4]]); // lun
    expect(ps('2026-11-02', 'P')).toEqual([[4], [3], [5]]);
    expect(ps('2026-11-03', 'M')).toEqual([[5], [4], [3]]); // mar
    expect(ps('2026-11-03', 'P')).toEqual([[5], [3], [4]]);
    expect(ps('2026-11-04', 'M')).toEqual([[5], [3], [4]]); // mer
    expect(ps('2026-11-04', 'P')).toEqual([[5], [4], [3]]);
    expect(ps('2026-11-05', 'M')).toEqual([[5], [4], [3]]); // gio
    expect(ps('2026-11-05', 'P')).toEqual([[5], [3], [4]]);
    expect(ps('2026-11-06', 'M')).toEqual([[5], [3], [4]]); // ven
    expect(ps('2026-11-06', 'P')).toEqual([[4], [3], [5]]);
  });

  it('nessun posto PS feriale facoltativo: ogni posto ha un anno', () => {
    for (const date of daysOfMonth('2026-11')) {
      expect(buildDemand(date, ctx).filter((p) => p.manualOnly && p.slot !== 'BAMBI')).toEqual([]);
    }
  });

  it('ambulatorio solo giovedì e venerdì', () => {
    for (const date of daysOfMonth('2026-11')) {
      const amb = buildDemand(date, ctx).some((p) => p.slot === 'AMB');
      expect(amb).toBe(weekday(date) === 4 || weekday(date) === 5);
    }
  });

  it('weekend: Ped Urg 12h a un IV anno, PS alti V + III, verdi III; il III fa 12h', () => {
    const d = buildDemand('2026-11-08', ctx); // domenica
    const pedu = d.find((p) => p.slot === 'PEDU_M')!;
    expect(pedu.alsoSlots).toEqual(['PEDU_P']);
    expect(d.find((p) => p.slot === 'PEDU_P')).toBeUndefined();
    const v = d.find((p) => p.slot === 'PS_ALTI_M' && p.idx === 0)!;
    expect([v.years, v.alsoSlots, v.notPrevDay]).toEqual([[5], ['PS_ALTI_P'], true]);
    expect(d.find((p) => p.slot === 'PS_ALTI_P')).toBeUndefined();
    const alti = d.find((p) => p.slot === 'PS_ALTI_M' && p.idx === 1)!;
    const verdi = d.find((p) => p.slot === 'PS_VERDI_M')!;
    expect([alti.years, alti.alsoSlots, alti.prevDaySlot]).toEqual([[3], ['PS_ALTI_P'], 'PS_VERDI_M']);
    expect([verdi.years, verdi.alsoSlots, verdi.prevDaySlot]).toEqual([[3], ['PS_VERDI_P'], 'PS_ALTI_M']);
    const sat = buildDemand('2026-11-07', ctx);
    expect(sat.some((p) => p.slot.startsWith('PS_') && (p.prevDaySlot || p.notPrevDay))).toBe(false);
    expect(sat.find((p) => p.slot === 'PS_ALTI_M' && p.idx === 0)!.alsoSlots).toEqual(['PS_ALTI_P']);
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

  it('OBI del V anno anche nel weekend, una sola persona per 12h', () => {
    const d = buildDemand('2026-11-08', ctx); // domenica
    const obi = d.find((p) => p.slot === 'OBI_M')!;
    expect([obi.years, obi.alsoSlots]).toEqual([[5], ['OBI_P']]);
    expect(d.find((p) => p.slot === 'OBI_P')).toBeUndefined();
    expect(buildDemand('2026-11-03', ctx).find((p) => p.slot === 'OBI_M')!.alsoSlots).toEqual([]); // mar: M e P separati
  });

  it('ruota comune solo come ripiego per le notti dal lunedì al venerdì', () => {
    for (const date of daysOfMonth('2026-11')) {
      for (const p of buildDemand(date, ctx)) {
        const wd = weekday(date);
        expect(p.ruotaFallback).toBe(p.slot === 'PS_NOTTE' && wd >= 1 && wd <= 5);
      }
    }
  });

  it('senza V anno i suoi turni passano a IV e III, ma il III non fa OBI', () => {
    const d = buildDemand('2027-10-29', { vPresent: false, vNightsPerPerson: 5 }); // ven
    expect(d.find((p) => p.slot === 'PS_ALTI_M' && p.idx === 0)!.years).toEqual([4, 3]);
    expect(d.find((p) => p.slot === 'PS_VERDI_P')!.years).toEqual([4, 3]);
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

  it('la ruota comune compare solo sulle notti dal lunedì al venerdì', () => {
    for (const a of res.assignments.filter((x) => x.who === RUOTA)) {
      expect(a.slot).toBe('PS_NOTTE');
      expect(weekday(a.date)).toBeGreaterThanOrEqual(1);
      expect(weekday(a.date)).toBeLessThanOrEqual(5);
    }
  });

  it('un solo turno al giorno (i 12h del weekend contano come uno)', () => {
    const pairs = [
      ['PEDU_M', 'PEDU_P'],
      ['PS_ALTI_M', 'PS_ALTI_P'],
      ['PS_VERDI_M', 'PS_VERDI_P'],
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

  it('massimo 5 notti al mese per il V anno, distribuite in modo bilanciato', () => {
    const nights: Record<string, number> = {};
    for (const a of res.assignments) if (a.slot === 'PS_NOTTE' && yearOf(a.who) === 5) nights[a.who] = (nights[a.who] ?? 0) + 1;
    const values = Object.values(nights);
    expect(Math.max(...values)).toBeLessThanOrEqual(5);
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1);
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

  it('il calendario suggerito non ha errori di validazione', () => {
    const errors = validate(input, res.assignments).filter((w) => w.level === 'error');
    expect(errors).toEqual([]);
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
    expect(msgs.some((m) => m.includes('III anno non può'))).toBe(true);
  });
});
