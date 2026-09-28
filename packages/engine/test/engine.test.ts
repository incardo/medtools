import { describe, expect, it } from 'vitest';
import {
  RUOTA,
  academicYearOf,
  addDays,
  buildDemand,
  daysOfMonth,
  keyOf,
  monthsOfAcademicYear,
  suggestMonth,
  validate,
  weekday,
  type Assignment,
} from '../src';
import { exampleInput } from './fixtures';

const yearOf = (id: string) => (id === RUOTA ? 0 : ({ a: 5, b: 5, c: 5, d: 5, e: 5, f: 4, g: 4, h: 4, i: 4, j: 4, k: 4 } as Record<string, number>)[id[0]] ?? 3);

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

  it('feriali: IV e III in fasce opposte, uno agli alti e uno ai verdi', () => {
    for (const date of daysOfMonth('2026-11').filter((d) => weekday(d) >= 1 && weekday(d) <= 5)) {
      const d = buildDemand(date, ctx);
      const iv = d.filter((p) => p.years.length === 1 && p.years[0] === 4 && p.slot.startsWith('PS_') && p.slot !== 'PS_NOTTE');
      const iii = d.filter((p) => p.years.length === 1 && p.years[0] === 3 && p.slot.startsWith('PS_'));
      expect(iv).toHaveLength(1);
      expect(iii).toHaveLength(1);
      expect(iv[0].slot.slice(-1)).not.toBe(iii[0].slot.slice(-1));
      const ivAlti = [1, 3, 5].includes(weekday(date));
      expect(iv[0].slot.startsWith(ivAlti ? 'PS_ALTI' : 'PS_VERDI')).toBe(true);
      expect(iii[0].slot.startsWith(ivAlti ? 'PS_VERDI' : 'PS_ALTI')).toBe(true);
    }
  });

  it('weekend: Ped Urg 12h a un solo IV anno, PS alti V + III, verdi III', () => {
    const d = buildDemand('2026-11-08', ctx); // domenica
    const pedu = d.find((p) => p.slot === 'PEDU_M')!;
    expect(pedu.alsoSlots).toEqual(['PEDU_P']);
    expect(d.find((p) => p.slot === 'PEDU_P')).toBeUndefined();
    expect(d.find((p) => p.slot === 'PS_ALTI_P' && p.idx === 0)!.years).toEqual([5]);
    expect(d.find((p) => p.slot === 'PS_ALTI_P' && p.idx === 1)!.years).toEqual([3]);
    expect(d.find((p) => p.slot === 'PS_VERDI_M')!.years).toEqual([3]);
  });

  it('Ped Urg mattina: un IV e un III anno, tutti i giorni', () => {
    for (const date of daysOfMonth('2026-11')) {
      const pm = buildDemand(date, ctx).filter((p) => p.slot === 'PEDU_M');
      expect(pm.map((p) => p.years)).toEqual([[4], [3]]);
    }
  });

  it('ruota comune solo come ripiego per le notti dal lunedì al venerdì', () => {
    for (const date of daysOfMonth('2026-11')) {
      for (const p of buildDemand(date, ctx)) {
        const wd = weekday(date);
        expect(p.ruotaFallback).toBe(p.slot === 'PS_NOTTE' && wd >= 1 && wd <= 5);
      }
    }
  });

  it('feriali: i posti PS senza anno assegnato sono facoltativi', () => {
    const d = buildDemand('2026-11-02', ctx); // lun
    const optional = d.filter((p) => p.manualOnly && p.slot !== 'BAMBI');
    expect(optional).toHaveLength(2);
    expect(optional.every((p) => p.slot.startsWith('PS_'))).toBe(true);
  });

  it('senza V anno i suoi turni passano a IV e III, ma il III non fa OBI', () => {
    const d = buildDemand('2027-10-29', { vPresent: false, vNightsPerPerson: 5 });
    expect(d.find((p) => p.slot === 'PS_ALTI_M' && p.idx === 0)!.years).toEqual([4, 3]);
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

  it('un solo turno al giorno (Ped Urg 12h nel weekend conta come uno)', () => {
    for (const list of byPersonDay.values()) {
      if (list.length === 1) continue;
      expect(list.map((a) => a.slot).sort()).toEqual(['PEDU_M', 'PEDU_P']);
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
        { personId: 'foxtrot', date: '2026-11-02', kind: 'F' },
        { personId: 'golf', date: '2026-11-02', kind: 'noM' },
      ],
    });
    const r = suggestMonth(withAbsence);
    const onDay = r.assignments.filter((a) => a.date === '2026-11-02');
    expect(onDay.some((a) => a.who === 'foxtrot')).toBe(false);
    expect(onDay.some((a) => a.who === 'golf' && a.slot.endsWith('_M'))).toBe(false);
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
      people: [...base.people, { id: 'romeo', name: 'Romeo', bambiInterest: false }],
      enrollments: [...base.enrollments, { personId: 'romeo', academicYear: '2026/27', year: 4, activeFrom: '2026-11-16' }],
    });
    const romeo = r.assignments.filter((a) => a.who === 'romeo');
    expect(romeo.length).toBeGreaterThan(0);
    expect(romeo.every((a) => a.date >= '2026-11-16')).toBe(true);
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
      { date: '2026-11-04', slot: 'OBI_M', idx: 0, who: 'lima', source: 'manual' },
    ]);
    const msgs = ws.filter((w) => w.level === 'error').map((w) => w.message);
    expect(msgs).toContain('Non disponibile (indisponibile)');
    expect(msgs).toContain('Più turni nello stesso giorno');
    expect(msgs.some((m) => m.includes('III anno non può'))).toBe(true);
  });
});
