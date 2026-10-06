import { Fragment, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import {
  ABSENCE_INFO,
  ABSENCE_LIMITS,
  addDays,
  buildDemand,
  daysOfMonth,
  demandForMonth,
  isWeekend,
  makeRoster,
  type AbsenceKind,
  type Fascia,
  type Position,
  type Year,
} from '@medtools/engine';
import { YEAR_LABEL, engineInput } from '../store';
import { dayLabel, monthLabel, shortDate, todayISO, type ViewProps } from '../format';

/** Voci del menu, a gruppi: giorno intero, una fascia esclusa, una sola fascia disponibile. */
const MENU: AbsenceKind[][] = [
  ['X', 'F'],
  ['noM', 'noP', 'noN'],
  ['soloM', 'soloP', 'soloN'],
];
const MENU_W = 170;
const MENU_H = 330;
const FASCE: Fascia[] = ['M', 'P', 'N'];

type Open = { personId: string; date: string; x: number; y: number };
/** Pennello: null = clic apre il menu; '' = cancella; altrimenti il tipo da scrivere. */
type Brush = AbsenceKind | '' | null;

/** Persone che servono a un anno di corso in un giorno: i suoi posti (12h = una persona) più chi smonta dalla notte prima. */
function needed(year: Year, today: Position[], yesterday: Position[]): number {
  const own = (p: Position) => !p.manualOnly && p.years.length === 1 && p.years[0] === year;
  const night = yesterday.some((p) => own(p) && p.slot === 'PS_NOTTE') ? 1 : 0;
  return today.filter(own).length + night;
}

export function AvailabilityView({ data, setData, month }: ViewProps) {
  const days = daysOfMonth(month);
  const input = useMemo(() => engineInput(data, month), [data, month]);
  const roster = useMemo(() => makeRoster(input), [input]);
  const demand = useMemo(() => demandForMonth(input, roster), [input, roster]);

  // Chi è attivo in almeno un giorno del mese, con l'anno di corso del primo giorno attivo.
  const rows = useMemo(() => {
    const out: { id: string; name: string; year: Year }[] = [];
    for (const p of data.people) {
      const first = days.find((d) => roster.yearOf(p.id, d));
      if (first) out.push({ id: p.id, name: p.name, year: roster.yearOf(p.id, first)! });
    }
    return out.sort((a, b) => b.year - a.year || a.name.localeCompare(b.name));
  }, [data.people, days, roster]);

  /** Per anno di corso e giorno: chi è assente tutto il giorno, chi solo in parte, quante persone servono e quante ci sono. */
  const totals = useMemo(() => {
    const before = addDays(days[0], -1);
    const prevDay = buildDemand(before, { vPresent: roster.vPresent(before) });
    const out = new Map<Year, { away: string[]; partial: string[]; need: number; active: number }[]>();
    for (const year of [5, 4, 3] as Year[]) {
      out.set(
        year,
        days.map((d, i) => {
          const active = roster.activeOn(d).filter((x) => x.year === year);
          const away: string[] = [];
          const partial: string[] = [];
          for (const { person } of active) {
            const off = FASCE.filter((f) => roster.unavailable(person.id, d, f));
            if (off.length === 3) away.push(person.name);
            else if (off.length) partial.push(person.name);
          }
          return { away, partial, need: needed(year, demand[i], i ? demand[i - 1] : prevDay), active: active.length };
        }),
      );
    }
    return out;
  }, [days, demand, roster]);

  const [open, setOpen] = useState<Open | null>(null);
  const [brush, setBrush] = useState<Brush>(null);
  // Trascinamento del pennello: solo sulla riga dove è iniziato.
  const painting = useRef<{ personId: string; done: Set<string> } | null>(null);

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

  useEffect(() => {
    const stop = () => (painting.current = null);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    return () => {
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
  }, []);

  const write = (personId: string, date: string, kind: AbsenceKind | '') =>
    setData((d) => {
      const k = `${personId}|${date}`;
      if ((d.absences[k] ?? '') === kind) return d;
      const absences = { ...d.absences };
      if (kind) absences[k] = kind;
      else delete absences[k];
      return { ...d, absences };
    });

  const paint = (personId: string, date: string) => {
    const p = painting.current;
    if (brush === null || !p || p.personId !== personId || p.done.has(date) || !roster.yearOf(personId, date)) return;
    p.done.add(date);
    write(personId, date, brush);
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!painting.current) return;
    const td = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest<HTMLElement>('td[data-person]');
    if (td) paint(td.dataset.person!, td.dataset.date!);
  };

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
    write(open.personId, open.date, kind);
    setOpen(null);
  };
  const current = open ? data.absences[`${open.personId}|${open.date}`] : undefined;

  const today = todayISO();

  // Scadenza: entro il 15 del mese precedente. Limiti sulle X: avviso, non blocco.
  const [y, m] = month.split('-').map(Number);
  const deadline = `${m === 1 ? y - 1 : y}-${String(m === 1 ? 12 : m - 1).padStart(2, '0')}-${String(ABSENCE_LIMITS.deadlineDay).padStart(2, '0')}`;
  const overLimit = useMemo(() => {
    const out = new Map<string, string>();
    for (const r of rows) {
      const xs = days.filter((d) => data.absences[`${r.id}|${d}`] === 'X');
      const we = xs.filter(isWeekend).length;
      const wd = xs.length - we;
      const msgs = [
        we > ABSENCE_LIMITS.weekendX ? `${we} X nel weekend (max ${ABSENCE_LIMITS.weekendX})` : '',
        wd > ABSENCE_LIMITS.weekdayX ? `${wd} X nei feriali (max ${ABSENCE_LIMITS.weekdayX})` : '',
      ].filter(Boolean);
      if (msgs.length) out.set(r.id, msgs.join(', '));
    }
    return out;
  }, [rows, days, data.absences]);

  const summaryRow = (year: Year) => {
    const cells = totals.get(year)!;
    return (
      <tr className="avail-total">
        <th className="sticky name">
          <span className={`chip y${year}`}>{YEAR_LABEL[year]}</span> assenti
        </th>
        {cells.map((c, i) => {
          const free = c.active - c.away.length;
          const level = !c.active ? '' : free < c.need ? ' short' : free === c.need ? ' tight' : '';
          const title = [
            `${YEAR_LABEL[year]} anno, ${dayLabel(days[i]).dow} ${dayLabel(days[i]).day}`,
            `Assenti tutto il giorno: ${c.away.length ? c.away.join(', ') : 'nessuno'}`,
            c.partial.length ? `Solo in parte: ${c.partial.join(', ')}` : '',
            `Presenti ${free} su ${c.active}; servono circa ${c.need} persone (posti del giorno + smonto dalla notte prima)`,
            level === ' short' ? 'Non bastano per coprire tutti i posti' : level === ' tight' ? 'Nessun margine' : '',
          ]
            .filter(Boolean)
            .join('\n');
          return (
            <td key={days[i]} className={`num${level}${isWeekend(days[i]) ? ' weekend' : ''}`} title={title}>
              {c.away.length || ''}
              {c.partial.length ? <sup>+{c.partial.length}</sup> : null}
            </td>
          );
        })}
        <td className="num">{cells.reduce((s, c) => s + c.away.length, 0) || ''}</td>
      </tr>
    );
  };

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
      <p className={`banner${today > deadline ? ' bad' : ''}`}>
        Le indisponibilità di {monthLabel(month)} vanno comunicate <b>entro il {shortDate(deadline)}</b>
        {today > deadline ? ' (termine scaduto: eventuali modifiche vanno concordate)' : ''}. Al massimo{' '}
        <b>{ABSENCE_LIMITS.weekendX} X nel weekend</b> e <b>{ABSENCE_LIMITS.weekdayX} X nei giorni feriali</b> per persona nel mese (le X
        sono le indisponibilità di giorno intero; ferie e indisponibilità parziali non contano).
      </p>
      {overLimit.size > 0 && (
        <p className="banner bad">
          Oltre il limite:{' '}
          {rows
            .filter((r) => overLimit.has(r.id))
            .map((r) => `${r.name} (${overLimit.get(r.id)})`)
            .join('; ')}
        </p>
      )}
      <div className="brush-bar" role="group" aria-label="Pennello">
        <span className="muted">Più giorni insieme: scegli un pennello e trascina sulla riga</span>
        <button className={brush === null ? 'active' : ''} onClick={() => setBrush(null)} title="Il clic su una cella apre il menu">
          Menu
        </button>
        {MENU.flat().map((k) => (
          <button key={k} className={brush === k ? 'active' : ''} onClick={() => setBrush(k)} title={ABSENCE_INFO[k].label}>
            <span className={`abs-tag ${k}`}>{ABSENCE_INFO[k].short}</span>
          </button>
        ))}
        <button className={brush === '' ? 'active' : ''} onClick={() => setBrush('')} title="Cancella i giorni su cui passi">
          <span className="abs-tag">—</span> cancella
        </button>
      </div>
      <div className="legend">
        <span className="muted">Righe "assenti": persone assenti tutto il giorno (ferie, indisponibili, esami); +N = assenti solo in parte.</span>
        <span className="chip avail-tight">nessun margine</span>
        <span className="chip avail-short">non bastano per i posti del giorno</span>
      </div>
      <div className="table-wrap">
        <table className={`avail${brush !== null ? ' brushing' : ''}`} onPointerMove={onPointerMove}>
          <thead>
            <tr>
              <th className="sticky">Persona</th>
              {days.map((d) => {
                const { dow, day } = dayLabel(d);
                return (
                  <th key={d} className={(isWeekend(d) ? 'weekend' : '') + (d === today ? ' today' : '')} title={d === today ? 'Oggi' : undefined}>
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
              <Fragment key={r.id}>
                <tr className={i > 0 && rows[i - 1].year !== r.year ? 'sep' : ''}>
                  <th className={`sticky name${overLimit.has(r.id) ? ' over' : ''}`} title={overLimit.get(r.id)}>
                    <span className={`chip y${r.year}`}>{YEAR_LABEL[r.year]}</span> {r.name}
                    {overLimit.has(r.id) && <span className="over-mark"> ⚠</span>}
                  </th>
                  {days.map((d) => {
                    const kind = data.absences[`${r.id}|${d}`];
                    const inactive = !roster.yearOf(r.id, d);
                    return (
                      <td
                        key={d}
                        data-person={r.id}
                        data-date={d}
                        className={`abs ${kind ?? ''} ${isWeekend(d) ? 'weekend' : ''} ${d === today ? 'today' : ''} ${inactive ? 'inactive' : ''} ${
                          open?.personId === r.id && open.date === d ? 'open' : ''
                        }`}
                        title={kind ? ABSENCE_INFO[kind].label : undefined}
                        onPointerDown={(e) => {
                          if (inactive || brush === null) return;
                          e.preventDefault();
                          painting.current = { personId: r.id, done: new Set() };
                          paint(r.id, d);
                        }}
                        onClick={(e) => !inactive && brush === null && openMenu(r.id, d, e.currentTarget)}
                      >
                        {kind ? ABSENCE_INFO[kind].short : ''}
                      </td>
                    );
                  })}
                  <td className="num">{days.filter((d) => data.absences[`${r.id}|${d}`]).length}</td>
                </tr>
                {(i === rows.length - 1 || rows[i + 1].year !== r.year) && summaryRow(r.year)}
              </Fragment>
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
