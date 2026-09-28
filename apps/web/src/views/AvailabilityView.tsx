import { useMemo } from 'react';
import { daysOfMonth, isWeekend, makeRoster, type AbsenceKind, type Year } from '@medtools/engine';
import { YEAR_LABEL, engineInput } from '../store';
import { dayLabel, monthLabel, type ViewProps } from '../format';

const CYCLE: (AbsenceKind | '')[] = ['', 'X', 'F', 'noM', 'noP'];
const SHORT: Record<AbsenceKind, string> = { X: 'X', F: 'F', noM: 'no M', noP: 'no P' };

export function AvailabilityView({ data, setData, month }: ViewProps) {
  const days = daysOfMonth(month);
  const input = useMemo(() => engineInput(data, month), [data, month]);
  const roster = useMemo(() => makeRoster(input), [input]);

  // Chi è attivo in almeno un giorno del mese, con l'anno di corso del primo giorno attivo.
  const rows = useMemo(() => {
    const out: { id: string; name: string; year: Year }[] = [];
    for (const p of data.people) {
      const first = days.find((d) => roster.yearOf(p.id, d));
      if (first) out.push({ id: p.id, name: p.name, year: roster.yearOf(p.id, first)! });
    }
    return out.sort((a, b) => b.year - a.year || a.name.localeCompare(b.name));
  }, [data.people, days, roster]);

  const cycle = (personId: string, date: string) =>
    setData((d) => {
      const k = `${personId}|${date}`;
      const next = CYCLE[(CYCLE.indexOf(d.absences[k] ?? '') + 1) % CYCLE.length];
      const absences = { ...d.absences };
      if (next) absences[k] = next;
      else delete absences[k];
      return { ...d, absences };
    });

  return (
    <section>
      <div className="toolbar">
        <h2>Disponibilità di {monthLabel(month)}</h2>
      </div>
      <p className="hint">
        Clicca una cella per cambiare: vuoto → <b>X</b> indisponibile → <b>F</b> ferie → <b>no M</b> → <b>no P</b> → vuoto. Ogni
        specializzando compila le proprie.
      </p>
      <div className="table-wrap">
        <table className="avail">
          <thead>
            <tr>
              <th className="sticky">Persona</th>
              {days.map((d) => {
                const { dow, day } = dayLabel(d);
                return (
                  <th key={d} className={isWeekend(d) ? 'weekend' : ''}>
                    <span className="dow">{dow}</span>
                    <br />
                    {day}
                  </th>
                );
              })}
              <th>Tot</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className={i > 0 && rows[i - 1].year !== r.year ? 'sep' : ''}>
                <th className="sticky name">
                  <span className={`chip y${r.year}`}>{YEAR_LABEL[r.year]}</span> {r.name}
                </th>
                {days.map((d) => {
                  const kind = data.absences[`${r.id}|${d}`];
                  const inactive = !roster.yearOf(r.id, d);
                  return (
                    <td
                      key={d}
                      className={`abs ${kind ?? ''} ${isWeekend(d) ? 'weekend' : ''} ${inactive ? 'inactive' : ''}`}
                      onClick={() => !inactive && cycle(r.id, d)}
                    >
                      {kind ? SHORT[kind] : ''}
                    </td>
                  );
                })}
                <td className="num">{days.filter((d) => data.absences[`${r.id}|${d}`]).length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
