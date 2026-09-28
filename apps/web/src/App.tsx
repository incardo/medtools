import { useState } from 'react';
import { monthsOfAcademicYear } from '@medtools/engine';
import { seedData, useAppData } from './store';
import { CalendarView } from './views/CalendarView';
import { AvailabilityView } from './views/AvailabilityView';
import { PeopleView } from './views/PeopleView';
import { OverviewView } from './views/OverviewView';
import { ParamsView } from './views/ParamsView';
import { monthLabel } from './format';

const TABS = [
  ['calendario', 'Calendario'],
  ['disponibilita', 'Disponibilità'],
  ['persone', 'Persone'],
  ['panoramica', 'Panoramica'],
  ['parametri', 'Parametri'],
] as const;

type Tab = (typeof TABS)[number][0];

export function App() {
  const [data, setData] = useAppData();
  const [tab, setTab] = useState<Tab>('calendario');
  const [month, setMonth] = useState('2026-11');
  const months = data.academicYears.flatMap((a) => monthsOfAcademicYear(a.id));

  const props = { data, setData, month };

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <strong>MedTools</strong>
          <span>Turni specializzandi PS</span>
        </div>
        <nav className="tabs">
          {TABS.map(([id, label]) => (
            <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </nav>
        <select className="month" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Mese">
          {months.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>
      </header>

      <div className="banner">
        Prototipo con <b>nomi fittizi</b>. I dati restano solo in questo browser: non inserire dati reali.{' '}
        <button
          className="link"
          onClick={() => {
            if (confirm('Ripristinare i dati di esempio? Le modifiche fatte andranno perse.')) setData(seedData());
          }}
        >
          Ripristina dati di esempio
        </button>
      </div>

      <main>
        {tab === 'calendario' && <CalendarView {...props} />}
        {tab === 'disponibilita' && <AvailabilityView {...props} />}
        {tab === 'persone' && <PeopleView {...props} />}
        {tab === 'panoramica' && <OverviewView {...props} />}
        {tab === 'parametri' && <ParamsView {...props} />}
      </main>
    </div>
  );
}
