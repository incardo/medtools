import { Fragment, useMemo, useState } from 'react';
import { daysOfMonth, demandForMonth, makeRoster, monthsOfAcademicYear, type Person, type Year } from '@medtools/engine';
import { YEAR_LABEL, academicYearFor, engineInput } from '../store';
import { monthLabel, type ViewProps } from '../format';
import { groupEnds, headerRows } from '../calendarHeaders';
import { SUMMARY_COLS, SUMMARY_HEADERS, SUMMARY_TURNS, slotsByYear, summarize, summaryValue, turnSlots, type SummaryCol } from '../summary';

const HEAD_ROWS = headerRows(SUMMARY_HEADERS);
const ENDS = groupEnds(HEAD_ROWS);
/** Colonne confrontate con la media del proprio anno di corso (le assenze no). */
const BALANCED: SummaryCol[] = [...SUMMARY_TURNS.map((t) => t.key), 'total', 'weekend'];

type Mode = 'mese' | 'anno';

/** Sfondo in base allo scarto dalla media del gruppo: blu sotto, arancione sopra, più intenso quanto più lontano. */
function heat(v: number, mean: number, maxDev: number): string | undefined {
  const d = v - mean;
  if (Math.abs(d) < 1) return undefined;
  const a = 0.12 + (0.45 * Math.abs(d)) / Math.max(maxDev, 1);
  return d < 0 ? `rgba(46, 144, 250, ${a.toFixed(2)})` : `rgba(247, 144, 9, ${a.toFixed(2)})`;
}

/** Assenze: stesso colore della scheda Disponibilità (ferie blu, indisponibile rosso, parziali giallo), più intenso quanti più giorni. */
const ABSENCE_RGB: Partial<Record<SummaryCol, string>> = { ferie: '31, 111, 235', indisp: '215, 38, 61', parziali: '232, 163, 23' };

function absenceBg(col: SummaryCol, v: number, max: number): string | undefined {
  const rgb = ABSENCE_RGB[col];
  if (!rgb || !v) return undefined;
  return `rgba(${rgb}, ${(0.12 + (0.48 * v) / Math.max(max, 1)).toFixed(2)})`;
}

export function OverviewView({ data, month }: ViewProps) {
  const [mode, setMode] = useState<Mode>('mese');
  const ay = academicYearFor(data, month);
  const days = daysOfMonth(month);
  const input = useMemo(() => engineInput(data, month), [data, month]);
  const roster = useMemo(() => makeRoster(input), [input]);
  const expected = useMemo(() => slotsByYear(demandForMonth(input, roster)), [input, roster]);
  const months = useMemo(
    () => (mode === 'mese' ? [month] : monthsOfAcademicYear(ay.id).filter((m) => m <= month)),
    [mode, month, ay.id],
  );
  const sums = useMemo(() => summarize(data, months), [data, months]);

  const groups = useMemo(() => {
    const byYear = new Map<Year, Person[]>();
    for (const p of data.people) {
      const first = days.find((d) => roster.yearOf(p.id, d));
      if (!first) continue;
      const y = roster.yearOf(p.id, first)!;
      byYear.set(y, [...(byYear.get(y) ?? []), p]);
    }
    return ([5, 4, 3] as Year[])
      .filter((y) => byYear.has(y))
      .map((year) => {
        const people = byYear.get(year)!.sort((a, b) => a.name.localeCompare(b.name));
        const pertinent = (p: Person, col: SummaryCol) =>
          col === 'BAMBI' ? p.bambiInterest : (turnSlots(col)?.some((s) => expected[year].has(s)) ?? true);
        // Media e scarto massimo per colonna, solo tra chi quel turno lo fa per regola.
        const stats = new Map<SummaryCol, { mean: number; maxDev: number }>();
        for (const col of BALANCED) {
          const vs = people.filter((p) => pertinent(p, col)).map((p) => summaryValue(sums[p.id], col));
          if (!vs.length) continue;
          const mean = vs.reduce((s, v) => s + v, 0) / vs.length;
          stats.set(col, { mean, maxDev: Math.max(...vs.map((v) => Math.abs(v - mean))) });
        }
        return { year, people, pertinent, stats };
      });
  }, [data.people, days, roster, expected, sums]);

  // Valore massimo di ogni colonna delle assenze, tra tutte le persone mostrate: dà la scala dei colori.
  const absMax = useMemo(() => {
    const ids = groups.flatMap((g) => g.people.map((p) => p.id));
    return Object.fromEntries(
      Object.keys(ABSENCE_RGB).map((col) => [col, Math.max(0, ...ids.map((id) => summaryValue(sums[id], col)))]),
    ) as Record<string, number>;
  }, [groups, sums]);

  const cls = (col: number, extra = '') =>`num${ENDS.has(col) ? ' gend' : ''}${extra}`;

  return (
    <section>
      <div className="toolbar">
        <h2>Panoramica · {monthLabel(month)}</h2>
        <div className="seg" role="group" aria-label="Periodo">
          <button className={mode === 'mese' ? 'active' : ''} onClick={() => setMode('mese')}>
            Mese
          </button>
          <button className={mode === 'anno' ? 'active' : ''} onClick={() => setMode('anno')}>
            Anno {ay.id} fino a {monthLabel(month).split(' ')[0]}
          </button>
        </div>
      </div>
      <p className="hint">
        Turni per tipo; mattina e pomeriggio si contano insieme (in PS restano separati alti, verdi e notte). Un turno da 12h conta come due. <b>Weekend</b> = giorni di sabato o domenica
        lavorati. Il totale esclude Bambi e gli alti opzionali (fuori dal bilanciamento); la ruota comune non è conteggiata. Lo storico dell'anno si azzera a novembre.
      </p>
      <div className="legend">
        <span className="chip" style={{ background: 'rgba(46, 144, 250, 0.35)' }}>
          sotto la media del proprio anno
        </span>
        <span className="chip" style={{ background: 'rgba(247, 144, 9, 0.35)' }}>
          sopra la media del proprio anno
        </span>
        <span className="chip">· turno non previsto per quell'anno</span>
      </div>
      <div className="table-wrap">
        <table className="overview cal">
          <thead>
            {HEAD_ROWS.map((row, r) => (
              <tr key={r}>
                {r === 0 && (
                  <th rowSpan={HEAD_ROWS.length} className="sticky">
                    Persona
                  </th>
                )}
                {row.map((h) => (
                  <th
                    key={h.col}
                    colSpan={h.colSpan}
                    rowSpan={h.rowSpan}
                    className={(r < 2 ? 'group' : '') + (ENDS.has(h.col + h.colSpan - 1) ? ' gend' : '')}
                  >
                    {h.label}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {groups.map(({ year, people, pertinent, stats }) => (
              <Fragment key={year}>
                <tr className="group-row">
                  <th className="sticky name">
                    <span className={`chip y${year}`}>{YEAR_LABEL[year]} anno</span>{' '}
                    <span className="muted">
                      {people.length} {people.length === 1 ? 'persona' : 'persone'} · media
                    </span>
                  </th>
                  {SUMMARY_COLS.map((col, i) => {
                    const s = stats.get(col);
                    return (
                      <td key={col} className={cls(i, ' muted')}>
                        {s ? s.mean.toFixed(1).replace('.', ',') : ''}
                      </td>
                    );
                  })}
                </tr>
                {people.map((p) => (
                  <tr key={p.id}>
                    <th className="sticky name">{p.name}</th>
                    {SUMMARY_COLS.map((col, i) => {
                      const v = summaryValue(sums[p.id], col);
                      const s = stats.get(col);
                      if (!pertinent(p, col) && !v)
                        return (
                          <td key={col} className={cls(i, ' na')} title="Non previsto per questo anno di corso">
                            ·
                          </td>
                        );
                      const bg = s && pertinent(p, col) ? heat(v, s.mean, s.maxDev) : absenceBg(col, v, absMax[col] ?? 0);
                      return (
                        <td
                          key={col}
                          className={cls(i, col === 'total' ? ' strong' : '')}
                          style={bg ? { background: bg } : undefined}
                          title={s ? `Media ${YEAR_LABEL[year]} anno: ${s.mean.toFixed(1).replace('.', ',')}` : undefined}
                        >
                          {v}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
