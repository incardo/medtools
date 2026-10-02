import { Fragment, useMemo, useState } from 'react';
import {
  COLUMNS,
  RUOTA,
  SLOT_INFO,
  addDays,
  daysOfMonth,
  demandForMonth,
  isWeekend,
  keyOf,
  makeRoster,
  ruotaCanCover,
  suggestMonth,
  validate,
  yearCanCover,
  type Fascia,
  type SlotCode,
  type Warning,
  type Year,
} from '@medtools/engine';
import { YEAR_LABEL, cellsToAssignments, engineInput, type Cell } from '../store';
import { dayLabel, monthLabel, type ViewProps } from '../format';
import { exportExcel } from '../exportExcel';
import { GROUP_ENDS, HEADER_DEPTH, headerRows } from '../calendarHeaders';

const HEAD_ROWS = headerRows();
const gend = (col: number) => (GROUP_ENDS.has(col) ? ' gend' : '');

export function CalendarView({ data, setData, month }: ViewProps) {
  const [busy, setBusy] = useState(false);
  const input = useMemo(() => engineInput(data, month), [data, month]);
  const roster = useMemo(() => makeRoster(input), [input]);
  const demand = useMemo(() => demandForMonth(input, roster), [input, roster]);
  const cells = data.assignments[month] ?? {};
  const assignments = useMemo(() => cellsToAssignments(cells), [cells]);
  const warnings = useMemo(() => validate(input, assignments), [input, assignments]);
  const names = useMemo(() => new Map(data.people.map((p) => [p.id, p.name])), [data.people]);

  const warnByKey = useMemo(() => {
    const m = new Map<string, Warning[]>();
    for (const w of warnings) {
      if (!w.slot) continue;
      const k = keyOf({ date: w.date, slot: w.slot, idx: w.idx ?? 0 });
      m.set(k, [...(m.get(k) ?? []), w]);
    }
    return m;
  }, [warnings]);

  /** Chi è libero ogni giorno e in quali fasce: attivo, non già in turno, non in smonto notte, non assente. */
  const freeByDay = useMemo(() => {
    const busy = new Map<string, Set<string>>();
    for (const a of [...(input.previous ?? []), ...assignments]) {
      if (a.who === RUOTA) continue;
      busy.set(a.date, (busy.get(a.date) ?? new Set()).add(a.who));
      if (a.slot === 'PS_NOTTE') busy.set(addDays(a.date, 1), (busy.get(addDays(a.date, 1)) ?? new Set()).add(a.who));
    }
    const out = new Map<string, { id: string; name: string; year: Year; fasce: Fascia[] }[]>();
    for (const date of daysOfMonth(month)) {
      const list = roster
        .activeOn(date)
        .filter(({ person }) => !busy.get(date)?.has(person.id))
        .map(({ person, year }) => ({
          id: person.id,
          name: person.name,
          year,
          fasce: (['M', 'P', 'N'] as Fascia[]).filter((f) => !roster.unavailable(person.id, date, f)),
        }))
        .filter((x) => x.fasce.length)
        .sort((a, b) => b.year - a.year || a.name.localeCompare(b.name));
      out.set(date, list);
    }
    return out;
  }, [input, roster, assignments, month]);

  const errors = warnings.filter((w) => w.level === 'error').length;
  const holes = warnings.filter((w) => w.message === 'Nessuno assegnato').length;
  const softs = warnings.length - errors - holes;
  const suggested = assignments.filter((a) => a.source === 'suggested').length;
  const manual = assignments.length - suggested;

  const setCells = (fn: (c: Record<string, Cell>) => Record<string, Cell>) =>
    setData((d) => ({ ...d, assignments: { ...d.assignments, [month]: fn({ ...(d.assignments[month] ?? {}) }) } }));

  const ruotaNames = data.ruotaNames ?? {};
  /** Nomi della ruota comune già usati, suggeriti mentre si scrive. */
  const ruotaKnown = useMemo(() => [...new Set(Object.values(data.ruotaNames ?? {}))].sort(), [data.ruotaNames]);
  const setRuotaName = (date: string, name: string) =>
    setData((d) => {
      const next = { ...(d.ruotaNames ?? {}) };
      if (name.trim()) next[date] = name.trim();
      else delete next[date];
      return { ...d, ruotaNames: next };
    });

  const generate = () => {
    const suggested = Object.values(cells).filter((v) => v.source === 'suggested').length;
    const msg = suggested
      ? `Rigenerare i suggerimenti di ${monthLabel(month)}?\n\nI ${suggested} turni suggeriti ora verranno sostituiti; le modifiche manuali restano.`
      : `Generare i suggerimenti per ${monthLabel(month)}?\n\nLe modifiche manuali restano.`;
    if (!confirm(msg)) return;
    setBusy(true);
    // lascia ridisegnare il pulsante prima del calcolo
    setTimeout(() => {
      const res = suggestMonth({ ...input, seed: Date.now() % 100000 });
      setCells((c) => {
        const next: Record<string, Cell> = {};
        for (const [k, v] of Object.entries(c)) if (v.source === 'manual') next[k] = v;
        for (const a of res.assignments) next[keyOf(a)] = { who: a.who, source: 'suggested' };
        return next;
      });
      setBusy(false);
    }, 20);
  };

  const [exporting, setExporting] = useState(false);
  const exportXlsx = async () => {
    setExporting(true);
    try {
      await exportExcel({ data, month, demand, cells, roster, headers: HEAD_ROWS });
    } catch (e) {
      alert(`Export non riuscito: ${e instanceof Error ? e.message : e}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <section>
      <div className="toolbar">
        <h2>Turni di {monthLabel(month)}</h2>
        <button className="primary" onClick={generate} disabled={busy}>
          {busy ? 'Calcolo…' : 'Genera suggerimenti'}
        </button>
        <button onClick={() => setCells((c) => Object.fromEntries(Object.entries(c).filter(([, v]) => v.source === 'manual')))}>
          Togli suggerimenti
        </button>
        <button
          onClick={() => {
            if (!confirm('Svuotare tutto il mese, comprese le modifiche manuali e i nomi della ruota comune?')) return;
            setCells(() => ({}));
            setData((d) => ({
              ...d,
              ruotaNames: Object.fromEntries(Object.entries(d.ruotaNames ?? {}).filter(([date]) => !date.startsWith(month))),
            }));
          }}
        >
          Svuota mese
        </button>
        <button onClick={exportXlsx} disabled={exporting}>
          {exporting ? 'Preparo il file…' : 'Esporta Excel'}
        </button>
      </div>

      <div className="stats">
        <span>{suggested} suggeriti</span>
        <span>{manual} manuali</span>
        <span className={errors ? 'bad' : ''}>{errors} errori</span>
        <span className={holes ? 'warn' : ''}>{holes} posti scoperti</span>
        <span className={softs ? 'warn' : ''}>{softs} smonti weekend saltati</span>
      </div>

      <div className="legend">
        <span className="chip y5">V anno</span>
        <span className="chip y4">IV anno</span>
        <span className="chip y3">III anno</span>
        <span className="chip ruota">Ruota comune (notti lun–ven)</span>
        <span className="chip optional">posto facoltativo</span>
        <span className="chip manual">✎ manuale</span>
        <span className="chip err">errore</span>
        <span className="chip wrn">scoperto / avviso</span>
      </div>

      <div className="table-wrap">
        <table className="cal">
          <thead>
            {HEAD_ROWS.map((row, r) => (
              <tr key={r}>
                {r === 0 && (
                  <th rowSpan={HEADER_DEPTH} className="sticky">
                    Giorno
                  </th>
                )}
                {row.map((h) => (
                  <th key={h.col} colSpan={h.colSpan} rowSpan={h.rowSpan} className={(r < 2 ? 'group' : '') + gend(h.col + h.colSpan - 1)}>
                    {h.label}
                  </th>
                ))}
                {r === 0 && (
                  <th rowSpan={HEADER_DEPTH} className="free-head">
                    Disponibili (non in turno)
                  </th>
                )}
              </tr>
            ))}
          </thead>
          <tbody>
            {demand.map((day) => {
              const date = day[0].date;
              const { dow, day: dd } = dayLabel(date);
              const active = roster.activeOn(date);
              return (
                <tr key={date} className={isWeekend(date) ? 'weekend' : ''}>
                  <th className="sticky day">
                    <span className="dow">{dow}</span> {dd}
                  </th>
                  {COLUMNS.map((col, i) => {
                    const k = keyOf({ date, ...col });
                    // Secondo posto di notte: ruota comune (con il nome scritto a mano) o un altro specializzando.
                    const secondNight = col.slot === 'PS_NOTTE' && col.idx === 1;
                    // Dati di prima: solo il nome della ruota comune, senza cella.
                    const cell: Cell | undefined = cells[k] ?? (secondNight && ruotaNames[date] ? { who: RUOTA, source: 'manual' } : undefined);
                    const pos = day.find((p) => p.slot === col.slot && p.idx === col.idx);
                    const mirror = day.find((p) => p.idx === col.idx && p.alsoSlots.includes(col.slot));
                    const ws = warnByKey.get(k) ?? [];
                    const year = cell?.who && cell.who !== RUOTA ? roster.yearOf(cell.who, date) : null;
                    // Colore dell'anno previsto dalla regola, anche se la cella è ancora vuota.
                    const expected = pos && !pos.manualOnly ? pos.years[0] : mirror ? mirror.years[0] : undefined;
                    const cls = [
                      'cell',
                      cell?.who === RUOTA ? 'ruota' : year ? `y${year}` : expected ? `y${expected} expected` : '',
                      !pos && !mirror ? 'unused' : '',
                      pos?.manualOnly && col.slot !== 'BAMBI' ? 'optional' : '',
                      cell?.source === 'manual' ? 'manual' : '',
                      ws.some((w) => w.level === 'error') ? 'err' : ws.length ? 'wrn' : '',
                    ].join(' ') + gend(i);
                    const title = [
                      !pos
                        ? mirror
                          ? 'Weekend: stessa persona della mattina (12h)'
                          : 'Non previsto dalle regole'
                        : pos.manualOnly
                          ? col.slot === 'BAMBI'
                            ? 'Bambi: facoltativo, solo chi è interessato'
                            : col.slot.startsWith('PS_OPZ')
                            ? 'Alti opzionale: per chi vuole fare un turno in più. Si compila a mano, non entra nel bilanciamento'
                            : secondNight
                            ? 'Secondo posto di notte: ruota comune (scrivi il nome) oppure un altro specializzando, che conta come notte anche nel bilanciamento'
                            : 'Posto facoltativo: si compila a mano con chi è disponibile'
                          : `Regola: ${pos.years.map((y) => YEAR_LABEL[y]).join(' / ')} anno${pos.ruotaFallback ? ', altrimenti ruota comune' : ''}`,
                      ...ws.map((w) => w.message),
                    ].join('\n');
                    const groups = ([5, 4, 3] as const).map((y) => ({
                      y,
                      opts: active.filter(
                        (x) => x.year === y && yearCanCover(y, col.slot as SlotCode) && (col.slot !== 'BAMBI' || x.person.bambiInterest),
                      ),
                    }));
                    const listed =
                      !cell?.who || (cell.who === RUOTA && ruotaCanCover(col.slot, date)) || groups.some((g) => g.opts.some((x) => x.person.id === cell.who));
                    return (
                      <Fragment key={k}>
                        <td className={cls} title={title}>
                          <select
                            value={cell?.who ?? ''}
                            onChange={(e) => {
                              if (secondNight && e.target.value !== RUOTA && ruotaNames[date]) setRuotaName(date, '');
                              setCells((c) => {
                                // Turno da 12h: la scelta vale per tutte le fasce dello stesso posto.
                                const main = pos ?? mirror;
                                const keys = main?.alsoSlots.length
                                  ? [main.slot, ...main.alsoSlots].map((slot) => keyOf({ date, slot, idx: main.idx }))
                                  : [k];
                                for (const key of keys) {
                                  if (e.target.value) c[key] = { who: e.target.value, source: 'manual' };
                                  else delete c[key];
                                }
                                return c;
                              });
                            }}
                          >
                            <option value="">—</option>
                            {!listed && (
                              <option value={cell!.who}>
                                {cell!.who === RUOTA ? 'Ruota comune' : (names.get(cell!.who) ?? '?')} (fuori regola)
                              </option>
                            )}
                            {ruotaCanCover(col.slot, date) && <option value={RUOTA}>Ruota comune</option>}
                            {groups.map(({ y, opts }) => {
                              if (!opts.length) return null;
                              return (
                                <optgroup key={y} label={`${YEAR_LABEL[y]} anno`}>
                                  {opts.map(({ person }) => {
                                    const why = roster.unavailable(person.id, date, SLOT_INFO[col.slot].fascia);
                                    return (
                                      <option key={person.id} value={person.id}>
                                        {person.name}
                                        {why ? ` (${why})` : ''}
                                      </option>
                                    );
                                  })}
                                </optgroup>
                              );
                            })}
                          </select>
                          {secondNight && cell?.who === RUOTA && (
                            <input
                              className="ruota-name"
                              key={`${date}|${ruotaNames[date] ?? ''}`}
                              list="ruota-names"
                              defaultValue={ruotaNames[date] ?? ''}
                              placeholder="nome…"
                              title="Nome di chi copre la ruota comune"
                              onBlur={(e) => e.target.value.trim() !== (ruotaNames[date] ?? '') && setRuotaName(date, e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                            />
                          )}
                        </td>
                      </Fragment>
                    );
                  })}
                  <td className="free">
                    {(freeByDay.get(date) ?? []).map((x) => (
                      <span
                        key={x.id}
                        className={`free-chip y${x.year}`}
                        title={`${x.name} · ${YEAR_LABEL[x.year]} anno · libero: ${x.fasce.map((f) => ({ M: 'mattina', P: 'pomeriggio', N: 'notte' })[f]).join(', ')}`}
                      >
                        {x.name} <small>{x.fasce.length === 3 ? 'M P N' : x.fasce.join(' ')}</small>
                      </span>
                    ))}
                    {!(freeByDay.get(date) ?? []).length && <span className="muted">nessuno</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <datalist id="ruota-names">
          {ruotaKnown.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      </div>
      <p className="hint">
        L'ultima colonna mostra chi è libero quel giorno (attivo, non già in turno, non in smonto dopo la notte) e in quali fasce: M
        mattina, P pomeriggio, N notte. Passa il mouse su una cella per vedere la regola e gli avvisi. Le celle modificate a mano restano quando rigeneri i suggerimenti.
      </p>
    </section>
  );
}
