import { Fragment, useMemo, useState } from 'react';
import {
  COLUMNS,
  EXTERNAL,
  OPTIONAL_WARDS,
  RUOTA,
  SLOT_INFO,
  addDays,
  daysOfMonth,
  demandForMonth,
  fasceOf,
  isPerson,
  festivoName,
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
import { dayLabel, monthLabel, todayISO, type ViewProps } from '../format';
import { exportExcel } from '../exportExcel';
import { exportPdf } from '../exportPdf';
import { GROUP_ENDS, HEADER_DEPTH, headerRows } from '../calendarHeaders';
import { MyShifts, loadMe, saveMe } from './MyShifts';

const HEAD_ROWS = headerRows();
const gend = (col: number) => (GROUP_ENDS.has(col) ? ' gend' : '');
/** Voce del menu per scrivere un nome a mano. */
const OTHER = '__altro__';
/** Porta in vista la prima cella (o il giorno) di un avviso e fa lampeggiare tutte quelle coinvolte. */
function jumpTo(ids: string[]) {
  const els = ids.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => !!el);
  if (!els.length) return;
  els[0].scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
  for (const el of els) {
    el.classList.remove('flash');
    void el.offsetWidth; // riavvia l'animazione se si clicca due volte
    el.classList.add('flash');
  }
  els[0].querySelector('select')?.focus({ preventScroll: true });
}
const HOLE = 'Nessuno assegnato';
type Kind = 'error' | 'hole' | 'warn' | 'info';
const KIND_ORDER: Kind[] = ['error', 'hole', 'warn', 'info'];
const KIND_LABEL: Record<Kind, string> = { error: 'Errori', hole: 'Scoperti', warn: 'Avvisi', info: 'Leggeri' };
const kindOf = (w: Warning): Kind => (w.level === 'error' ? 'error' : w.message === HOLE ? 'hole' : w.level);
/** Tipo di problema, senza i dettagli del caso (es. "Non disponibile: ..." → "Non disponibile"). */
const categoryOf = (message: string) => message.split(/[:(]/)[0].trim();
/** Una riga dell'elenco: le celle con lo stesso problema (stesso `group`) diventano una riga sola. */
interface Issue {
  kind: Kind;
  date: string;
  message: string;
  category: string;
  cells: { slot?: SlotCode; idx: number }[];
  persons: string[];
}
const ADMIN_NAME_KEY = 'medtools:adminName';
function loadAdminName(): string {
  try {
    return localStorage.getItem(ADMIN_NAME_KEY) ?? '';
  } catch {
    return '';
  }
}
function saveAdminName(name: string) {
  try {
    localStorage.setItem(ADMIN_NAME_KEY, name);
  } catch {
    // senza localStorage il nome si richiede da capo la prossima volta
  }
}
const norm = (s: string) =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();

export function CalendarView({ data, setData, month, requireAdmin }: ViewProps) {
  const [busy, setBusy] = useState(false);
  const [me, setMeState] = useState(loadMe);
  const setMe = (id: string) => {
    setMeState(id);
    saveMe(id);
  };
  const input = useMemo(() => engineInput(data, month), [data, month]);
  const roster = useMemo(() => makeRoster(input), [input]);
  const demand = useMemo(() => demandForMonth(input, roster), [input, roster]);
  const cells = data.assignments[month] ?? {};
  /** Turni bloccati: nessuna modifica finché un admin non sblocca il mese. */
  const locked = !!data.lockedMonths?.[month];
  const setLocked = async (on: boolean) => {
    const why = on
      ? `Bloccare i turni di ${monthLabel(month)} è riservato a chi ha la password admin.`
      : `I turni di ${monthLabel(month)} sono bloccati: solo chi ha la password admin può sbloccarli.`;
    if (!(await requireAdmin(why))) return;
    if (!confirm(on ? `Bloccare i turni di ${monthLabel(month)}?

Nessuno potrà più modificare il calendario finché un admin non lo sblocca.` : `Sbloccare i turni di ${monthLabel(month)}?

Tutti potranno di nuovo modificare il calendario.`))
      return;
    setData((d) => {
      const lockedMonths = { ...(d.lockedMonths ?? {}) };
      if (on) lockedMonths[month] = true;
      else delete lockedMonths[month];
      return { ...d, lockedMonths };
    });
  };
  const assignments = useMemo(() => cellsToAssignments(cells), [cells]);
  const warnings = useMemo(() => validate(input, assignments), [input, assignments]);
  /** Giorni in cui la persona scelta con "Io sono" ha un turno: riga evidenziata. */
  const myDays = useMemo(() => new Set(me ? assignments.filter((a) => a.who === me).map((a) => a.date) : []), [assignments, me]);
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
      if (!isPerson(a.who)) continue;
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

  /** Elenco: una riga per problema, errori in cima, poi in ordine di giorno e di colonna. */
  const issues = useMemo(() => {
    const col = (c: Issue['cells'][number]) => COLUMNS.findIndex((x) => x.slot === c.slot && x.idx === c.idx);
    const byGroup = new Map<string, Issue>();
    warnings.forEach((w, i) => {
      const k = w.group ? `${w.group}|${w.message}` : `#${i}`;
      const it = byGroup.get(k);
      const cell = { slot: w.slot, idx: w.idx ?? 0 };
      if (it) {
        it.cells.push(cell);
        if (w.personId && !it.persons.includes(w.personId)) it.persons.push(w.personId);
      } else {
        byGroup.set(k, { kind: kindOf(w), date: w.date, message: w.message, category: categoryOf(w.message), cells: [cell], persons: w.personId ? [w.personId] : [] });
      }
    });
    const list = [...byGroup.values()];
    for (const it of list) it.cells.sort((a, b) => col(a) - col(b));
    return list.sort(
      (a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.date.localeCompare(b.date) || col(a.cells[0]) - col(b.cells[0]),
    );
  }, [warnings]);
  const count = (k: Kind) => issues.filter((it) => it.kind === k).length;
  const errors = count('error');
  const holes = count('hole');
  const infos = count('info');
  const softs = count('warn');
  const [kindFilter, setKindFilter] = useState<Kind | 'all'>('all');
  const [catFilter, setCatFilter] = useState<string | null>(null);
  const [onlyMine, setOnlyMine] = useState(false);
  const mineOk = (it: Issue) => !onlyMine || !me || it.persons.includes(me);
  const kindOk = (it: Issue) => kindFilter === 'all' || it.kind === kindFilter;
  /** Tipi di problema con il conteggio (secondo i filtri scelti), dal più grave. */
  const categories = new Map<string, { n: number; kind: Kind }>();
  for (const it of issues) {
    if (!kindOk(it) || !mineOk(it)) continue;
    const c = categories.get(it.category);
    categories.set(it.category, { n: (c?.n ?? 0) + 1, kind: c && KIND_ORDER.indexOf(c.kind) < KIND_ORDER.indexOf(it.kind) ? c.kind : it.kind });
  }
  const categoryList = [...categories].sort((a, b) => KIND_ORDER.indexOf(a[1].kind) - KIND_ORDER.indexOf(b[1].kind) || b[1].n - a[1].n);
  const shown = issues.filter((it) => kindOk(it) && mineOk(it) && (!catFilter || it.category === catFilter));
  /** Turni di ogni persona per giorno, per segnare nel menu chi è già impegnato. */
  const shiftsOf = useMemo(() => {
    const m = new Map<string, { slot: SlotCode; idx: number }[]>();
    for (const a of [...(input.previous ?? []), ...assignments]) {
      if (!isPerson(a.who)) continue;
      const k = `${a.who}|${a.date}`;
      m.set(k, [...(m.get(k) ?? []), { slot: a.slot, idx: a.idx }]);
    }
    return m;
  }, [input, assignments]);
  const suggested = assignments.filter((a) => a.source === 'suggested').length;
  const manual = assignments.length - suggested;
  const today = todayISO();

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

  /**
   * Nome scritto a mano: se corrisponde a una persona dell'anagrafica diventa quella persona (e si conta),
   * altrimenti resta un nome esterno (si mostra e si esporta, ma non si conta).
   */
  const askName = (current?: string): string | null => {
    const typed = prompt(
      'Nome di chi copre il turno.\nSe è nella scheda Persone il turno si conta in Panoramica e nel bilanciamento; altrimenti resta solo il nome.',
      current?.startsWith(EXTERNAL) ? current.slice(EXTERNAL.length) : '',
    )?.trim();
    if (!typed) return null;
    const t = norm(typed);
    const exact = data.people.find((p) => norm(p.name) === t);
    if (exact) return exact.id;
    const partial = t.length >= 3 ? data.people.filter((p) => norm(p.name).includes(t)) : [];
    if (partial.length === 1 && confirm(`"${typed}": intendi ${partial[0].name} (scheda Persone)?`)) return partial[0].id;
    return EXTERNAL + typed;
  };

  const generate = async () => {
    if (!(await requireAdmin('Generare i suggerimenti del calendario è riservato a chi ha la password admin.'))) return;
    const suggested = Object.values(cells).filter((v) => v.source === 'suggested').length;
    const msg = suggested
      ? `Rigenerare i suggerimenti di ${monthLabel(month)}?\n\nI ${suggested} turni suggeriti ora verranno sostituiti; le modifiche manuali restano.`
      : `Generare i suggerimenti per ${monthLabel(month)}?\n\nLe modifiche manuali restano.`;
    if (!confirm(msg)) return;
    // Nome di chi genera, mostrato nella scheda Parametri.
    const name = prompt('Il tuo nome (comparirà nella scheda Parametri come autore dei turni generati):', loadAdminName() || names.get(me) || '')?.trim();
    if (!name) return;
    saveAdminName(name);
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
      const at = Date.now();
      setData((d) => ({ ...d, generations: { ...d.generations, [`${month}|${at}`]: { name, at } } }));
      setBusy(false);
    }, 20);
  };

  const [exporting, setExporting] = useState<'xlsx' | 'pdf' | null>(null);
  const exportAs = async (kind: 'xlsx' | 'pdf') => {
    setExporting(kind);
    try {
      const input = { data, month, demand, cells, roster, headers: HEAD_ROWS };
      await (kind === 'xlsx' ? exportExcel(input) : exportPdf(input));
    } catch (e) {
      alert(`Export non riuscito: ${e instanceof Error ? e.message : e}`);
    } finally {
      setExporting(null);
    }
  };

  return (
    <section>
      <div className="toolbar">
        <h2>Turni di {monthLabel(month)}</h2>
        <button className="primary" onClick={generate} disabled={busy || locked}>
          {busy ? 'Calcolo…' : 'Genera suggerimenti'}
        </button>
        <button
          onClick={async () =>
            (await requireAdmin('Togliere i suggerimenti del calendario è riservato a chi ha la password admin.')) &&
            setCells((c) => Object.fromEntries(Object.entries(c).filter(([, v]) => v.source === 'manual')))
          }
          disabled={locked}
        >
          Togli suggerimenti
        </button>
        <button
          className="danger"
          disabled={locked}
          onClick={async () => {
            if (!(await requireAdmin('Svuotare il mese è riservato a chi ha la password admin.'))) return;
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
        <button className={locked ? 'lock-on' : ''} onClick={() => setLocked(!locked)} title={locked ? 'Solo un admin può sbloccare' : 'Nessuno potrà più modificare il calendario del mese'}>
          {locked ? '🔒 Sblocca turni' : 'Blocca turni'}
        </button>
        <button onClick={() => exportAs('xlsx')} disabled={!!exporting}>
          {exporting === 'xlsx' ? 'Preparo il file…' : 'Esporta Excel'}
        </button>
        <button onClick={() => exportAs('pdf')} disabled={!!exporting}>
          {exporting === 'pdf' ? 'Preparo il file…' : 'Esporta PDF'}
        </button>
      </div>

      {locked && (
        <p className="banner">
          🔒 <b>Turni di {monthLabel(month)} bloccati</b>: il calendario non si può più modificare. Per cambiarlo un admin deve premere "Sblocca turni".
        </p>
      )}

      <div className="stats">
        <span>{suggested} suggeriti</span>
        <span>{manual} manuali</span>
        <span className={errors ? 'bad' : ''}>{errors} errori</span>
        <span className={holes ? 'warn' : ''}>{holes} posti scoperti</span>
        <span className={softs ? 'warn' : ''}>{softs} avvisi</span>
        <span>{infos} avvisi leggeri</span>
      </div>

      {issues.length > 0 && (
        <details className="warn-list">
          <summary>
            Elenco di errori e avvisi ({issues.length}) <span className="muted">· clicca per andare alla cella</span>
          </summary>
          <div className="warn-filters">
            {(['all', ...KIND_ORDER] as const).map((k) => {
              const n = k === 'all' ? issues.length : count(k);
              if (k !== 'all' && !n) return null;
              return (
                <button
                  key={k}
                  className={`warn-filter${kindFilter === k ? ' on' : ''}`}
                  onClick={() => {
                    setKindFilter(k);
                    setCatFilter(null);
                  }}
                >
                  {k === 'all' ? 'Tutti' : KIND_LABEL[k]} <span className="muted">{n}</span>
                </button>
              );
            })}
            {me && (
              <label className="warn-mine">
                <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} /> solo i miei ({names.get(me)})
              </label>
            )}
          </div>
          <div className="warn-cats">
            {categoryList.map(([c, { n, kind }]) => (
              <button
                key={c}
                className={`warn-cat ${kind}${catFilter === c ? ' on' : ''}`}
                onClick={() => setCatFilter(catFilter === c ? null : c)}
                title={catFilter === c ? 'Mostra tutti i tipi' : 'Mostra solo questo tipo'}
              >
                {c} <b>×{n}</b>
              </button>
            ))}
          </div>
          <ul>
            {shown.map((it, i) => {
              const { dow, day } = dayLabel(it.date);
              const ids = it.cells.map((c) => (c.slot ? `cell-${keyOf({ date: it.date, slot: c.slot, idx: c.idx })}` : `day-${it.date}`));
              const who = it.persons.map((p) => names.get(p)).filter(Boolean);
              const slots = [...new Set(it.cells.filter((c) => c.slot).map((c) => `${SLOT_INFO[c.slot!].label}${c.idx ? ` (${c.idx + 1}°)` : ''}`))];
              return (
                <li key={i}>
                  <button className={`warn-item ${it.kind === 'error' ? 'bad' : it.kind === 'info' ? 'info' : 'warn'}`} onClick={() => jumpTo(ids)}>
                    <span className="warn-when">
                      {dow} {Number(day)}
                      {slots.length ? ` · ${slots.join(' + ')}` : ''}
                    </span>
                    {who.length ? <b>{who.join(', ')}:</b> : null} {it.message}
                  </button>
                </li>
              );
            })}
            {!shown.length && <li className="muted">Nessuna voce con questi filtri.</li>}
          </ul>
        </details>
      )}

      <MyShifts data={data} month={month} roster={roster} assignments={assignments} me={me} setMe={setMe} />

      <div className="legend">
        <span className="chip y5">V anno</span>
        <span className="chip y4">IV anno</span>
        <span className="chip y3">III anno</span>
        <span className="chip ruota">Ruota comune (notti lun–ven)</span>
        <span className="chip optional">posto facoltativo</span>
        <span className="chip manual">✎ manuale</span>
        <span className="chip err">errore</span>
        <span className="chip wrn">scoperto / avviso</span>
        {me && <span className="chip mine">i miei turni</span>}
        {month === today.slice(0, 7) && (
          <span className="chip">
            <span className="today-dot" /> oggi
          </span>
        )}
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
                <tr
                  key={date}
                  className={
                    (isWeekend(date) ? 'weekend' : '') + (festivoName(date) ? ' festivo' : '') + (myDays.has(date) ? ' mine-row' : '') + (date === today ? ' today' : '')
                  }
                >
                  <th
                    id={`day-${date}`}
                    className="sticky day"
                    title={[date === today && 'Oggi', festivoName(date) && `Festivo: ${festivoName(date)}`].filter(Boolean).join(' · ') || undefined}
                  >
                    <span className="dow">{dow}</span> {dd}
                    {date === today && <span className="today-dot" aria-label="oggi" />}
                  </th>
                  {COLUMNS.map((col, i) => {
                    const k = keyOf({ date, ...col });
                    // Secondo posto di notte: ruota comune (con il nome scritto a mano) o un IV anno.
                    const secondNight = col.slot === 'PS_NOTTE' && col.idx === 1;
                    // Dati di prima: solo il nome della ruota comune, senza cella.
                    const cell: Cell | undefined = cells[k] ?? (secondNight && ruotaNames[date] ? { who: RUOTA, source: 'manual' } : undefined);
                    const pos = day.find((p) => p.slot === col.slot && p.idx === col.idx);
                    const mirror = day.find((p) => p.idx === col.idx && p.alsoSlots.includes(col.slot));
                    const ws = warnByKey.get(k) ?? [];
                    const year = cell?.who && cell.who !== RUOTA ? roster.yearOf(cell.who, date) : null;
                    // Colore dell'anno previsto dalla regola, anche se la cella è ancora vuota.
                    const expected = pos && !pos.manualOnly ? pos.years[0] : mirror ? mirror.years[0] : undefined;
                    // Posto della ruota comune: nessun anno di corso.
                    const ruotaPos = !!pos && !pos.manualOnly && !pos.years.length;
                    const cls = [
                      'cell',
                      cell?.who === RUOTA ? 'ruota' : year ? `y${year}` : expected ? `y${expected} expected` : ruotaPos && !cell?.who ? 'ruota expected' : '',
                      !pos && !mirror ? 'unused' : '',
                      pos?.manualOnly && col.slot !== 'BAMBI' ? 'optional' : '',
                      cell?.source === 'manual' ? 'manual' : '',
                      ws.some((w) => w.level === 'error') ? 'err' : ws.some((w) => w.level === 'warn') ? 'wrn' : ws.length ? 'inf' : '',
                      me && cell?.who === me ? 'mine' : '',
                    ].join(' ') + gend(i);
                    const title = [
                      !pos
                        ? mirror
                          ? 'Weekend: stessa persona della mattina (12h)'
                          : 'Non previsto dalle regole'
                        : pos.manualOnly
                          ? col.slot === 'BAMBI'
                            ? 'Bambi: facoltativo, solo chi è interessato'
                            : OPTIONAL_WARDS.includes(col.slot)
                            ? `${SLOT_INFO[col.slot].label}: facoltativo, V o IV anno, tutto il giorno. Si compila a mano, non entra nel bilanciamento`
                            : 'Posto facoltativo: si compila a mano con chi è disponibile'
                          : ruotaPos
                            ? 'Regola: ruota comune (scrivi il nome). Uno specializzando messo qui conta come una notte'
                            : `Regola: ${pos.years.map((y) => YEAR_LABEL[y]).join(' / ')} anno${pos.ruotaFallback ? ', altrimenti ruota comune' : ''}`,
                      ...ws.map((w) => w.message),
                    ].join('\n');
                    const groups = ([5, 4, 3] as const).map((y) => ({
                      y,
                      opts: active.filter(
                        (x) => x.year === y && yearCanCover(y, col.slot as SlotCode) && (col.slot !== 'BAMBI' || x.person.bambiInterest),
                      ),
                    }));
                    // Fasce occupate da questo posto (un 12h le occupa tutte), per segnare nel menu chi è già impegnato.
                    const main = pos ?? mirror;
                    const mySlots = main?.alsoSlots.length ? [main.slot, ...main.alsoSlots] : [col.slot as SlotCode];
                    const myFasce = mySlots.flatMap((s) => fasceOf(s));
                    const listed =
                      !cell?.who || (cell.who === RUOTA && ruotaCanCover(col.slot, date)) || groups.some((g) => g.opts.some((x) => x.person.id === cell.who));
                    return (
                      <Fragment key={k}>
                        <td id={`cell-${k}`} className={cls} title={title}>
                          <select
                            disabled={locked}
                            value={cell?.who ?? ''}
                            onChange={(e) => {
                              const value = e.target.value === OTHER ? askName(cell?.who) : e.target.value;
                              if (value === null) return;
                              if (secondNight && value !== RUOTA && ruotaNames[date]) setRuotaName(date, '');
                              setCells((c) => {
                                // Turno da 12h: la scelta vale per tutte le fasce dello stesso posto.
                                const keys = main?.alsoSlots.length
                                  ? [main.slot, ...main.alsoSlots].map((slot) => keyOf({ date, slot, idx: main.idx }))
                                  : [k];
                                for (const key of keys) {
                                  if (value) c[key] = { who: value, source: 'manual' };
                                  else delete c[key];
                                }
                                return c;
                              });
                            }}
                          >
                            <option value="">—</option>
                            {!listed && (
                              <option value={cell!.who}>
                                {cell!.who === RUOTA
                                  ? 'Ruota comune (fuori regola)'
                                  : cell!.who.startsWith(EXTERNAL)
                                    ? `${cell!.who.slice(EXTERNAL.length)} (non in anagrafica)`
                                    : `${names.get(cell!.who) ?? '?'} (fuori regola)`}
                              </option>
                            )}
                            {ruotaCanCover(col.slot, date) && <option value={RUOTA}>Ruota comune</option>}
                            {col.slot === 'BAMBI' && groups.every((g) => !g.opts.length) && (
                              <option disabled>Nessun interessato: spunta "Bambi" nella scheda Persone</option>
                            )}
                            {groups.map(({ y, opts }) => {
                              if (!opts.length) return null;
                              return (
                                <optgroup key={y} label={`${YEAR_LABEL[y]} anno`}>
                                  {opts
                                    .map(({ person }) => {
                                      const why =
                                        roster.unavailableForSlots(person.id, date, [col.slot]) ?? roster.excludedFrom(person.id, [col.slot]);
                                      // Già in turno quel giorno (escluso questo posto, anche se da 12h): stessa fascia = errore, va in fondo.
                                      const busyNow = (shiftsOf.get(`${person.id}|${date}`) ?? []).filter(
                                        (o) => !(o.idx === (main?.idx ?? col.idx) && mySlots.includes(o.slot)),
                                      );
                                      const clash = busyNow.find((o) => fasceOf(o.slot).some((f) => myFasce.includes(f)));
                                      const afterNight = (shiftsOf.get(`${person.id}|${addDays(date, -1)}`) ?? []).some((o) => o.slot === 'PS_NOTTE');
                                      const note = clash
                                        ? `⚠ già in ${SLOT_INFO[clash.slot].label}`
                                        : afterNight
                                          ? '⚠ smonto notte'
                                          : busyNow.length
                                            ? `anche ${busyNow.map((o) => SLOT_INFO[o.slot].label).join(', ')}`
                                            : '';
                                      const rank = person.id === cell?.who ? 0 : clash || afterNight || why ? 2 : busyNow.length ? 1 : 0;
                                      return { person, label: [why, note].filter(Boolean).join(', '), rank };
                                    })
                                    .sort((a, b) => a.rank - b.rank)
                                    .map(({ person, label }) => (
                                      <option key={person.id} value={person.id}>
                                        {person.name}
                                        {label ? ` (${label})` : ''}
                                      </option>
                                    ))}
                                </optgroup>
                              );
                            })}
                            <option value={OTHER}>✎ Altro nome…</option>
                          </select>
                          {secondNight && cell?.who === RUOTA && (
                            <input
                              className="ruota-name"
                              disabled={locked}
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
