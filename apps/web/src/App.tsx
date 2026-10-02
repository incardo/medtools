import { useState, type FormEvent } from 'react';
import { monthsOfAcademicYear } from '@medtools/engine';
import { browserData, initialComposition } from './store';
import { useSharedData, type SyncStatus } from './sync';
import { CalendarView } from './views/CalendarView';
import { AvailabilityView } from './views/AvailabilityView';
import { PeopleView } from './views/PeopleView';
import { OverviewView } from './views/OverviewView';
import { ParamsView } from './views/ParamsView';
import { RulesView } from './views/RulesView';
import { monthLabel } from './format';
import { AvailabilityIcon, CalendarIcon, OverviewIcon, ParamsIcon, PeopleIcon, RulesIcon } from './icons';

const TABS = [
  ['calendario', 'Calendario', CalendarIcon],
  ['disponibilita', 'Disponibilità', AvailabilityIcon],
  ['persone', 'Persone', PeopleIcon],
  ['panoramica', 'Panoramica', OverviewIcon],
  ['regole', 'Regole', RulesIcon],
  ['parametri', 'Parametri', ParamsIcon],
] as const;

type Tab = (typeof TABS)[number][0];

export function App() {
  const { data, setData, status, empty, login, logout, refresh } = useSharedData();
  const [tab, setTab] = useState<Tab>('calendario');
  const [month, setMonth] = useState('2026-11');
  const months = data.academicYears.flatMap((a) => monthsOfAcademicYear(a.id));

  const props = { data, setData, month };

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#d92d20" d="M9 2h6v7h7v6h-7v7H9v-7H2V9h7z" />
          </svg>
          <div>
            <strong>MedTools</strong>
            <span>Turni specializzandi PS</span>
          </div>
        </div>
        <nav className="tabs">
          {TABS.map(([id, label, TabIcon]) => (
            <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
              <TabIcon />
              {label}
            </button>
          ))}
        </nav>
        <SyncBadge status={status} />
        {status.state !== 'login' && status.state !== 'blocked' && (
          <button className="link logout" onClick={logout} title="Esci da questo browser">
            Esci
          </button>
        )}
        <select className="month" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Mese">
          {months.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>
      </header>

      {status.state === 'login' ? (
        <Login onLogin={login} />
      ) : status.state === 'blocked' ? (
        <div className="banner bad">{status.message}</div>
      ) : status.state === 'loading' ? (
        <div className="banner">Caricamento dei dati…</div>
      ) : empty ? (
        <EmptyStart onLoad={setData} />
      ) : null}

      {status.state !== 'login' && status.state !== 'blocked' && status.state !== 'loading' && (
        <main>
          {tab === 'calendario' && <CalendarView {...props} />}
          {tab === 'disponibilita' && <AvailabilityView {...props} />}
          {tab === 'persone' && <PeopleView {...props} />}
          {tab === 'panoramica' && <OverviewView {...props} />}
          {tab === 'regole' && <RulesView {...props} />}
          {tab === 'parametri' && <ParamsView {...props} onRestored={refresh} />}
        </main>
      )}
    </div>
  );
}

function SyncBadge({ status }: { status: SyncStatus }) {
  const [text, cls] =
    status.state === 'ok'
      ? ['Salvato', 'ok']
      : status.state === 'saving'
        ? ['Salvataggio…', '']
        : status.state === 'loading'
          ? ['Caricamento…', '']
          : status.state === 'blocked' || status.state === 'login'
            ? ['Non connesso', 'bad']
            : ['Non salvato: riprovo', 'bad'];
  return (
    <span className={`sync ${cls}`} title={status.state === 'error' || status.state === 'blocked' ? status.message : 'Dati condivisi con tutti gli utenti'}>
      {text}
    </span>
  );
}

/** Database condiviso ancora vuoto: si parte dai dati di questo browser o dalla composizione iniziale. */
function EmptyStart({ onLoad }: { onLoad: (d: ReturnType<typeof initialComposition>) => void }) {
  const local = browserData();
  return (
    <div className="banner">
      Il database condiviso è vuoto. Da dove partiamo?{' '}
      {local && (
        <button className="link" onClick={() => confirm(`Caricare i dati di questo browser (${local.people.length} persone, turni e assenze)?`) && onLoad(local)}>
          Usa i dati salvati in questo browser
        </button>
      )}
      {local && ' oppure '}
      <button className="link" onClick={() => confirm('Caricare la composizione iniziale 2026/27 (V 10, IV 8, III 6)?') && onLoad(initialComposition())}>
        Usa la composizione iniziale
      </button>
      . Poi nomi e composizione si correggono nella scheda Persone.
    </div>
  );
}

function Login({ onLogin }: { onLogin: (password: string) => Promise<void> }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onLogin(password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Accesso non riuscito');
      setBusy(false);
    }
  };
  return (
    <form className="login" onSubmit={submit}>
      <h2>Accesso</h2>
      <p className="hint">Inserisci la password condivisa tra gli specializzandi. Resti collegato su questo browser per 30 giorni.</p>
      <input type="password" autoFocus autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
      <button className="primary" disabled={busy || !password}>
        {busy ? 'Verifico…' : 'Entra'}
      </button>
      {error && <p className="login-error">{error}</p>}
    </form>
  );
}
