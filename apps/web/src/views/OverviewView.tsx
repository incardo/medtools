import { useMemo } from 'react';
import { countAssignments, daysOfMonth, makeRoster, monthsOfAcademicYear, type Family, type Year } from '@medtools/engine';
import { YEAR_LABEL, academicYearFor, cellsToAssignments, engineInput } from '../store';
import { monthLabel, type ViewProps } from '../format';

const FAMILIES: [Family, string][] = [
  ['PS_ALTI', 'PS alti'],
  ['PS_VERDI', 'PS verdi'],
  ['PS_NOTTE', 'Notti'],
  ['OBI', 'OBI'],
  ['PEDU', 'Ped Urg'],
  ['AMB', 'Amb'],
  ['BAMBI', 'Bambi'],
];

export function OverviewView({ data, month }: ViewProps) {
  const ay = academicYearFor(data, month);
  const days = daysOfMonth(month);
  const roster = useMemo(() => makeRoster(engineInput(data, month)), [data, month]);
  const monthCounts = useMemo(() => countAssignments(cellsToAssignments(data.assignments[month])), [data, month]);
  const yearCounts = useMemo(
    () =>
      countAssignments(
        monthsOfAcademicYear(ay.id)
          .filter((m) => m <= month)
          .flatMap((m) => cellsToAssignments(data.assignments[m])),
      ),
    [data, month, ay.id],
  );

  const rows = data.people
    .map((p) => {
      const first = days.find((d) => roster.yearOf(p.id, d));
      return first ? { p, year: roster.yearOf(p.id, first)! as Year } : null;
    })
    .filter((x) => x !== null)
    .sort((a, b) => b.year - a.year || a.p.name.localeCompare(b.p.name));

  const total = (c: Partial<Record<Family, number>> | undefined) =>
    FAMILIES.filter(([f]) => f !== 'BAMBI').reduce((s, [f]) => s + (c?.[f] ?? 0), 0);

  return (
    <section>
      <div className="toolbar">
        <h2>Panoramica · {monthLabel(month)}</h2>
      </div>
      <p className="hint">
        Numero = turni nel mese; tra parentesi il totale dell'anno {ay.id} fino a questo mese (lo storico si azzera a novembre). Bambi e la
        ruota comune non entrano nel bilanciamento.
      </p>
      <div className="table-wrap">
        <table className="overview">
          <thead>
            <tr>
              <th className="sticky">Persona</th>
              {FAMILIES.map(([, l]) => (
                <th key={l}>{l}</th>
              ))}
              <th>Totale</th>
              <th>Ferie</th>
              <th>Indisp.</th>
              <th>no M / no P</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ p, year }, i) => {
              const abs = days.map((d) => data.absences[`${p.id}|${d}`]);
              return (
                <tr key={p.id} className={i > 0 && rows[i - 1].year !== year ? 'sep' : ''}>
                  <th className="sticky name">
                    <span className={`chip y${year}`}>{YEAR_LABEL[year]}</span> {p.name}
                  </th>
                  {FAMILIES.map(([f]) => (
                    <td key={f} className="num">
                      {monthCounts[p.id]?.[f] ?? 0} <span className="muted">({yearCounts[p.id]?.[f] ?? 0})</span>
                    </td>
                  ))}
                  <td className="num strong">
                    {total(monthCounts[p.id])} <span className="muted">({total(yearCounts[p.id])})</span>
                  </td>
                  <td className="num">{abs.filter((k) => k === 'F').length}</td>
                  <td className="num">{abs.filter((k) => k === 'X').length}</td>
                  <td className="num">{abs.filter((k) => k === 'noM' || k === 'noP').length}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
