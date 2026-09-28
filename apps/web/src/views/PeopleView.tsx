import { useMemo, useState } from 'react';
import { addDays, makeRoster, type AcademicYear, type Enrollment, type Year } from '@medtools/engine';
import { YEAR_LABEL, academicYearFor, engineInput, newId } from '../store';
import { shortDate, type ViewProps } from '../format';

function nextYearId(id: string): string {
  const s = Number(id.slice(0, 4)) + 1;
  return `${s}/${String((s + 1) % 100).padStart(2, '0')}`;
}

export function PeopleView({ data, setData, month }: ViewProps) {
  const ay = academicYearFor(data, month);
  const firstDay = `${month}-01`;
  const [refDate, setRefDate] = useState(firstDay);
  const roster = useMemo(() => makeRoster(engineInput(data, month)), [data, month]);
  const composition = roster.activeOn(refDate < ay.start || refDate > ay.end ? firstDay : refDate);

  const [name, setName] = useState('');
  const [year, setYear] = useState<Year>(3);
  const [from, setFrom] = useState(firstDay);

  const enrolledThisYear = data.enrollments.filter((e) => e.academicYear === ay.id);
  const enrolledIds = new Set(enrolledThisYear.map((e) => e.personId));
  const others = data.people.filter((p) => !enrolledIds.has(p.id));
  const nameOf = (id: string) => data.people.find((p) => p.id === id)?.name ?? '?';

  // Confronto per contenuto, non per riferimento: i dati possono essere stati ricaricati dal server nel frattempo.
  const same = (a: Enrollment, b: Enrollment) => a.personId === b.personId && a.academicYear === b.academicYear && a.activeFrom === b.activeFrom;
  const updateEnrollment = (e: Enrollment, patch: Partial<Enrollment>) =>
    setData((d) => ({ ...d, enrollments: d.enrollments.map((x) => (same(x, e) ? { ...x, ...patch } : x)) }));

  const addPerson = () => {
    if (!name.trim()) return;
    const id = newId(name);
    setData((d) => ({
      ...d,
      people: [...d.people, { id, name: name.trim(), bambiInterest: false }],
      enrollments: [...d.enrollments, { personId: id, academicYear: ay.id, year, activeFrom: from }],
    }));
    setName('');
  };

  const reactivate = (personId: string, y: Year) =>
    setData((d) => ({
      ...d,
      enrollments: [...d.enrollments, { personId, academicYear: ay.id, year: y, activeFrom: from < ay.start ? ay.start : from }],
    }));

  const nextId = nextYearId(ay.id);
  const hasNext = data.academicYears.some((a) => a.id === nextId);
  const openNextYear = () => {
    const s = Number(nextId.slice(0, 4));
    const next: AcademicYear = { id: nextId, start: `${s}-11-01`, end: `${s + 1}-10-31`, vLastDay: `${s + 1}-10-27` };
    // Promozione automatica: III → IV, IV → V. Il V anno esce. Chi era già uscito non passa.
    const promoted: Enrollment[] = enrolledThisYear
      .filter((e) => e.year < 5 && (!e.activeTo || e.activeTo >= ay.end))
      .map((e) => ({ personId: e.personId, academicYear: nextId, year: (e.year + 1) as Year, activeFrom: next.start }));
    if (!confirm(`Aprire l'anno ${nextId}? Passano d'anno ${promoted.length} persone; il V anno esce. Poi potrai aggiungere il nuovo III anno.`))
      return;
    setData((d) => ({ ...d, academicYears: [...d.academicYears, next], enrollments: [...d.enrollments, ...promoted] }));
  };

  return (
    <section>
      <div className="toolbar">
        <h2>Persone · anno {ay.id}</h2>
        {!hasNext && <button onClick={openNextYear}>Apri anno {nextId} (passaggio d'anno)</button>}
      </div>

      <h3>
        Composizione al{' '}
        <input type="date" value={refDate} min={ay.start} max={ay.end} onChange={(e) => setRefDate(e.target.value)} />
      </h3>
      <div className="composition">
        {([5, 4, 3] as const).map((y) => {
          const list = composition.filter((x) => x.year === y);
          return (
            <div key={y} className={`comp y${y}`}>
              <div className="comp-head">
                {YEAR_LABEL[y]} anno <span>{list.length}</span>
              </div>
              <ul>
                {list.map((x) => (
                  <li key={x.person.id}>{x.person.name}</li>
                ))}
                {!list.length && <li className="muted">nessuno</li>}
              </ul>
            </div>
          );
        })}
        <div className="comp ruota">
          <div className="comp-head">Ruota comune</div>
          <ul>
            <li className="muted">persone a caso, non in anagrafica</li>
          </ul>
        </div>
      </div>

      <h3>Iscritti all'anno {ay.id}</h3>
      <div className="table-wrap">
        <table className="people">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Anno</th>
              <th>Attivo dal</th>
              <th>Attivo fino al</th>
              <th>Bambi</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {[...enrolledThisYear]
              .sort((a, b) => b.year - a.year || nameOf(a.personId).localeCompare(nameOf(b.personId)))
              .map((e) => {
                const p = data.people.find((x) => x.id === e.personId);
                if (!p) return null;
                return (
                  <tr key={`${e.personId}-${data.enrollments.indexOf(e)}`}>
                    <td>
                      <input
                        value={p.name}
                        onChange={(ev) =>
                          setData((d) => ({ ...d, people: d.people.map((x) => (x.id === p.id ? { ...x, name: ev.target.value } : x)) }))
                        }
                      />
                    </td>
                    <td>
                      <select value={e.year} onChange={(ev) => updateEnrollment(e, { year: Number(ev.target.value) as Year })}>
                        {([3, 4, 5] as const).map((y) => (
                          <option key={y} value={y}>
                            {YEAR_LABEL[y]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input type="date" value={e.activeFrom} onChange={(ev) => updateEnrollment(e, { activeFrom: ev.target.value })} />
                    </td>
                    <td>
                      <input
                        type="date"
                        value={e.activeTo ?? ''}
                        onChange={(ev) => updateEnrollment(e, { activeTo: ev.target.value || undefined })}
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={p.bambiInterest}
                        onChange={(ev) =>
                          setData((d) => ({
                            ...d,
                            people: d.people.map((x) => (x.id === p.id ? { ...x, bambiInterest: ev.target.checked } : x)),
                          }))
                        }
                      />
                    </td>
                    <td className="actions">
                      <button onClick={() => updateEnrollment(e, { activeTo: addDays(from, -1) })} title="Esce dal giorno scelto sotto">
                        Fai uscire
                      </button>
                      <button
                        className="danger"
                        onClick={() => {
                          if (confirm(`Togliere ${p.name} dall'anno ${ay.id}? I turni già assegnati restano nel calendario.`))
                            setData((d) => ({ ...d, enrollments: d.enrollments.filter((x) => !same(x, e)) }));
                        }}
                      >
                        Togli
                      </button>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      <h3>Aggiungi o fai rientrare</h3>
      <div className="form">
        <label>
          Dal giorno <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          Nome <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Cognome" />
        </label>
        <label>
          Anno
          <select value={year} onChange={(e) => setYear(Number(e.target.value) as Year)}>
            {([3, 4, 5] as const).map((y) => (
              <option key={y} value={y}>
                {YEAR_LABEL[y]}
              </option>
            ))}
          </select>
        </label>
        <button className="primary" onClick={addPerson}>
          Aggiungi
        </button>
      </div>
      <p className="hint">
        "Fai uscire" imposta l'ultimo giorno al giorno prima di <b>{shortDate(from)}</b>. Chi entra a metà anno parte con il conteggio da zero.
      </p>

      {others.length > 0 && (
        <>
          <h3>Archivio (non iscritti a questo anno)</h3>
          <ul className="archive">
            {others.map((p) => (
              <li key={p.id}>
                {p.name}{' '}
                {([3, 4, 5] as const).map((y) => (
                  <button key={y} onClick={() => reactivate(p.id, y)}>
                    Rientra al {YEAR_LABEL[y]}
                  </button>
                ))}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
