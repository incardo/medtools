import { Fragment, useMemo, useState } from 'react';
import { ABSENCE_INFO, SLOT_INFO, addDays, daysOfMonth, isWeekend, type Assignment, type Roster, type SlotCode } from '@medtools/engine';
import { YEAR_LABEL, type AppData } from '../store';
import { dayLabel, monthLabel } from '../format';
import { SUMMARY_TURNS, summarize, summaryValue } from '../summary';

/** Persona scelta con "Io sono": solo in questo browser. */
const ME_KEY = 'medtools:me';
export function loadMe(): string {
  try {
    return localStorage.getItem(ME_KEY) ?? '';
  } catch {
    return '';
  }
}
export function saveMe(id: string) {
  try {
    if (id) localStorage.setItem(ME_KEY, id);
    else localStorage.removeItem(ME_KEY);
  } catch {
    // senza storage la scelta vale solo finché la pagina resta aperta
  }
}

const TURN_LABEL: Record<string, string> = {
  PS_ALTI: 'PS alti',
  PS_OPZ: 'PS alti opz.',
  PS_VERDI: 'PS verdi',
  PS_NOTTE: 'Notti',
  OBI: 'OBI',
  PEDU: 'Ped Urg',
  BAMBI: 'Bambi',
  AMB: 'Amb',
};

/** Turni di un giorno in parole: mattina e pomeriggio dello stesso tipo diventano "12h". */
function dayShifts(slots: SlotCode[]): string[] {
  const out: string[] = [];
  const set = new Set(slots);
  for (const s of slots) {
    const { fascia, label } = SLOT_INFO[s];
    const other = (fascia === 'M' ? s.replace(/_M$/, '_P') : s.replace(/_P$/, '_M')) as SlotCode;
    if (other !== s && set.has(other)) {
      if (fascia === 'M') out.push(`${label.replace(/ M$/, '')} 12h`);
      continue;
    }
    out.push(label);
  }
  return out;
}

/** Giorni consecutivi con la stessa assenza, uniti in un intervallo. */
function absenceRanges(data: AppData, me: string, month: string) {
  const out: { from: string; to: string; label: string }[] = [];
  for (const d of daysOfMonth(month)) {
    const k = data.absences[`${me}|${d}`];
    if (!k) continue;
    const last = out[out.length - 1];
    if (last && last.label === ABSENCE_INFO[k].label && addDays(last.to, 1) === d) last.to = d;
    else out.push({ from: d, to: d, label: ABSENCE_INFO[k].label });
  }
  return out;
}

const fmt = (d: string) => {
  const { dow, day } = dayLabel(d);
  return `${dow} ${Number(day)}`;
};

/** File .ics con un evento di tutto il giorno per ogni giorno di turno (gli orari non sono nell'app). */
function downloadIcs(name: string, month: string, days: [string, string[]][]) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const esc = (s: string) => s.replace(/[\\;,]/g, (c) => `\\${c}`);
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//medtools//turni//IT', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${esc(`Turni ${name}`)}`];
  for (const [date, shifts] of days) {
    const d = date.replace(/-/g, '');
    lines.push(
      'BEGIN:VEVENT',
      // UID stabile: reimportando il file dopo una modifica, molti calendari aggiornano l'evento invece di duplicarlo
      `UID:${date}-${name.replace(/\W/g, '')}@medtools`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${d}`,
      `DTEND;VALUE=DATE:${addDays(date, 1).replace(/-/g, '')}`,
      `SUMMARY:${esc(shifts.join(' + '))}`,
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  const blob = new Blob([lines.join('\r\n') + '\r\n'], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `turni-${name.replace(/\s+/g, '_')}-${month}.ics`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

interface Props {
  data: AppData;
  month: string;
  roster: Roster;
  assignments: Assignment[];
  me: string;
  setMe: (id: string) => void;
}

export function MyShifts({ data, month, roster, assignments, me, setMe }: Props) {
  const people = useMemo(() => {
    const days = daysOfMonth(month);
    const year = new Map<string, number>();
    for (const d of [days[0], days[days.length - 1]])
      for (const { person, year: y } of roster.activeOn(d)) if (!year.has(person.id)) year.set(person.id, y);
    return data.people
      .map((p) => ({ ...p, year: year.get(p.id) }))
      .sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || a.name.localeCompare(b.name));
  }, [data.people, roster, month]);
  const person = data.people.find((p) => p.id === me);

  const days = useMemo(() => {
    const by = new Map<string, SlotCode[]>();
    for (const a of assignments) if (a.who === me) by.set(a.date, [...(by.get(a.date) ?? []), a.slot]);
    return [...by.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([d, s]) => [d, dayShifts(s)] as [string, string[]]);
  }, [assignments, me]);
  const summary = useMemo(() => (me ? summarize(data, [month])[me] : undefined), [data, month, me]);
  const absences = useMemo(() => (me ? absenceRanges(data, me, month) : []), [data, me, month]);
  const [copied, setCopied] = useState(false);

  /** Sequenza dei turni come testo, da incollare in un messaggio. */
  const copyText = () =>
    `Turni di ${person?.name} – ${monthLabel(month)}\n` + days.map(([d, shifts]) => `${fmt(d)} ${shifts.join(' + ')}`).join(' → ');
  const copy = async () => {
    const text = copyText();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // senza accesso agli appunti (es. pagina non sicura): si copia a mano
      prompt('Copia il testo:', text);
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <details className="mine-panel" open>
      <summary>
        <strong>I miei turni</strong>
        <span className="muted"> · {monthLabel(month)}</span>
      </summary>
      <div className="mine-head">
        <label>
          Io sono{' '}
          <select value={person ? me : ''} onChange={(e) => setMe(e.target.value)}>
            <option value="">— scegli —</option>
            {([5, 4, 3, undefined] as const).map((y) => {
              const list = people.filter((p) => p.year === y);
              if (!list.length) return null;
              return (
                <optgroup key={y ?? 0} label={y ? `${YEAR_LABEL[y]} anno` : 'Non attivi questo mese'}>
                  {list.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        </label>
        {person && days.length > 0 && (
          <button onClick={() => downloadIcs(person.name, month, days)} title="Un evento di tutto il giorno per ogni giorno di turno, da aprire con il calendario del telefono o del computer">
            Aggiungi al calendario (.ics)
          </button>
        )}
      </div>
      {!person ? (
        <p className="hint">Scegli il tuo nome per vedere solo i tuoi turni del mese ed evidenziarli nel calendario. La scelta resta salvata in questo browser.</p>
      ) : (
        <>
          <div className="mine-totals">
            {SUMMARY_TURNS.map(({ key }) => {
              const n = summaryValue(summary, key);
              return n ? (
                <span key={key}>
                  {TURN_LABEL[key]} <b>{n}</b>
                </span>
              ) : null;
            })}
            <span>
              Totale <b>{summaryValue(summary, 'total')}</b>
            </span>
            <span>
              Weekend <b>{summaryValue(summary, 'weekend')}</b>
            </span>
          </div>
          {days.length ? (
            <div className="mine-seq">
              {days.map(([d, shifts], i) => (
                <Fragment key={d}>
                  {i > 0 && <span className="mine-arrow">→</span>}
                  <span className={`mine-step${isWeekend(d) ? ' weekend' : ''}`}>
                    <span className="mine-day">{fmt(d)}</span> {shifts.join(' + ')}
                  </span>
                </Fragment>
              ))}
              <button className="mine-copy" onClick={copy} title="Copia la sequenza come testo, da incollare in un messaggio">
                {copied ? 'Copiato ✓' : 'Copia'}
              </button>
            </div>
          ) : (
            <p className="hint">Nessun turno assegnato a {person.name} in {monthLabel(month)}.</p>
          )}
          {absences.length > 0 && (
            <p className="mine-abs">
              <span className="muted">Assenze:</span>{' '}
              {absences.map((r) => `${fmt(r.from)}${r.to !== r.from ? `–${fmt(r.to)}` : ''} ${r.label}`).join(' · ')}
            </p>
          )}
        </>
      )}
    </details>
  );
}
