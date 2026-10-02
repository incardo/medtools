import { useState } from 'react';
import type { ExamDay, MonthParams, Year } from '@medtools/engine';
import { YEAR_LABEL, academicYearFor, paramsFor } from '../store';
import { monthLabel, shortDate, type ViewProps } from '../format';
import { HistoryPanel } from './HistoryPanel';

export function ParamsView({ data, setData, month, onRestored }: ViewProps & { onRestored: () => Promise<void> }) {
  const ay = academicYearFor(data, month);
  const params = paramsFor(data, month);
  const [exam, setExam] = useState<ExamDay>({ date: `${month}-01`, years: [5], nightOnly: false });

  const setParams = (patch: Partial<MonthParams>) =>
    setData((d) => ({ ...d, monthParams: { ...d.monthParams, [month]: { ...paramsFor(d, month), ...patch } } }));

  return (
    <section>
      <div className="toolbar">
        <h2>Parametri</h2>
      </div>

      <h3>Anno {ay.id}</h3>
      <div className="form">
        <label>
          Inizio <input type="date" value={ay.start} disabled />
        </label>
        <label>
          Fine <input type="date" value={ay.end} disabled />
        </label>
        <label>
          Ultimo giorno V anno (incluso)
          <input
            type="date"
            value={ay.vLastDay}
            onChange={(e) =>
              setData((d) => ({
                ...d,
                academicYears: d.academicYears.map((a) => (a.id === ay.id ? { ...a, vLastDay: e.target.value } : a)),
              }))
            }
          />
        </label>
      </div>

      <h3>{monthLabel(month)}</h3>

      <h4>Esami e assenze collettive</h4>
      {params.exams.length === 0 && <p className="muted">Nessuno.</p>}
      <ul className="exams">
        {params.exams.map((ex, i) => (
          <li key={i}>
            {shortDate(ex.date)} · {ex.years.map((y) => YEAR_LABEL[y]).join(', ')} anno · {ex.nightOnly ? 'solo notte' : 'tutto il giorno'}{' '}
            <button className="danger" onClick={() => setParams({ exams: params.exams.filter((_, j) => j !== i) })}>
              Togli
            </button>
          </li>
        ))}
      </ul>
      <div className="form">
        <label>
          Data
          <input type="date" value={exam.date} onChange={(e) => setExam({ ...exam, date: e.target.value })} />
        </label>
        {([3, 4, 5] as Year[]).map((y) => (
          <label key={y} className="check">
            <input
              type="checkbox"
              checked={exam.years.includes(y)}
              onChange={(e) =>
                setExam({ ...exam, years: e.target.checked ? [...exam.years, y].sort() : exam.years.filter((x) => x !== y) })
              }
            />
            {YEAR_LABEL[y]}
          </label>
        ))}
        <label className="check">
          <input type="checkbox" checked={exam.nightOnly} onChange={(e) => setExam({ ...exam, nightOnly: e.target.checked })} />
          solo la notte
        </label>
        <button
          className="primary"
          disabled={!exam.years.length || !exam.date.startsWith(month)}
          onClick={() => setParams({ exams: [...params.exams, exam] })}
        >
          Aggiungi
        </button>
      </div>
      <p className="hint">Esempio: esame del V anno il 5 → "tutto il giorno" il 5 e "solo la notte" il 4.</p>

      <HistoryPanel onRestored={onRestored} />
    </section>
  );
}
