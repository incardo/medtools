import { useEffect, useMemo, useState } from 'react';
import { ABSENCE_INFO, daysOfMonth, isWeekend, makeRoster, type AbsenceKind, type Year } from '@medtools/engine';
import { YEAR_LABEL, engineInput } from '../store';
import { dayLabel, monthLabel, type ViewProps } from '../format';

/** Voci del menu, a gruppi: giorno intero, una fascia esclusa, una sola fascia disponibile. */
const MENU: AbsenceKind[][] = [
  ['X', 'F'],
  ['noM', 'noP', 'noN'],
  ['soloM', 'soloP', 'soloN'],
];
const MENU_W = 170;
const MENU_H = 330;

type Open = { personId: string; date: string; x: number; y: number };

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

  const [open, setOpen] = useState<Open | null>(null);

  // Il menu si chiude con Esc, scorrendo o cliccando fuori.
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(null);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  const openMenu = (personId: string, date: string, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setOpen({
      personId,
      date,
      x: Math.max(8, Math.min(r.left, window.innerWidth - MENU_W - 8)),
      y: r.bottom + MENU_H > window.innerHeight ? Math.max(8, r.top - MENU_H) : r.bottom,
    });
  };

  const choose = (kind: AbsenceKind | '') => {
    if (!open) return;
    const k = `${open.personId}|${open.date}`;
    setData((d) => {
      const absences = { ...d.absences };
      if (kind) absences[k] = kind;
      else delete absences[k];
      return { ...d, absences };
    });
    setOpen(null);
  };
  const current = open ? data.absences[`${open.personId}|${open.date}`] : undefined;

  return (
    <section>
      <div className="toolbar">
        <h2>Disponibilità di {monthLabel(month)}</h2>
      </div>
      <p className="hint">
        Clicca una cella e scegli: <b>X</b> indisponibile, <b>F</b> ferie, <b>no M</b> / <b>no P</b> / <b>no N</b> (esclude una
        fascia), <b>solo M</b> / <b>solo P</b> / <b>solo N</b> (disponibile solo in quella fascia). Ogni specializzando compila le
        proprie.
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
                      className={`abs ${kind ?? ''} ${isWeekend(d) ? 'weekend' : ''} ${inactive ? 'inactive' : ''} ${
                        open?.personId === r.id && open.date === d ? 'open' : ''
                      }`}
                      title={kind ? ABSENCE_INFO[kind].label : undefined}
                      onClick={(e) => !inactive && openMenu(r.id, d, e.currentTarget)}
                    >
                      {kind ? ABSENCE_INFO[kind].short : ''}
                    </td>
                  );
                })}
                <td className="num">{days.filter((d) => data.absences[`${r.id}|${d}`]).length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && (
        <>
          <div className="menu-backdrop" onClick={() => setOpen(null)} />
          <div className="abs-menu" style={{ left: open.x, top: open.y }} role="menu">
            <div className="abs-menu-head">
              {rows.find((r) => r.id === open.personId)?.name} · {dayLabel(open.date).dow} {dayLabel(open.date).day}
            </div>
            <button className={!current ? 'active' : ''} onClick={() => choose('')}>
              <span className="abs-tag">—</span> disponibile
            </button>
            {MENU.map((group, i) => (
              <div key={i} className="abs-menu-group">
                {group.map((k) => (
                  <button key={k} className={current === k ? 'active' : ''} onClick={() => choose(k)}>
                    <span className={`abs-tag ${k}`}>{ABSENCE_INFO[k].short}</span> {ABSENCE_INFO[k].label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
