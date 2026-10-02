import { useEffect, useState } from 'react';

/**
 * Versioni precedenti dei dati condivisi (vedi functions/api/history.ts).
 * Le scritture vicine nel tempo (meno di SESSION_GAP l'una dall'altra) sono raggruppate in una "sessione";
 * per ogni sessione si può tornare a com'era tutto subito prima.
 */

interface Version {
  t: number;
  n: number;
  kinds: string[];
  restoreOf?: number;
}

interface Session {
  first: number;
  last: number;
  n: number;
  kinds: string[];
  restoreOf?: number;
}

const SESSION_GAP = 5 * 60_000;
const PAGE = 30;

const KIND_LABEL: Record<string, string> = {
  person: 'persone',
  enrollment: 'iscrizioni',
  year: 'anno',
  absence: 'disponibilità',
  params: 'parametri',
  cell: 'calendario',
  ruota: 'ruota comune',
};

const when = (t: number) =>
  new Date(t).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const time = (t: number) => new Date(t).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

function sessions(versions: Version[]): Session[] {
  const out: Session[] = [];
  for (const v of versions) {
    const cur = out[out.length - 1];
    if (cur && !cur.restoreOf && !v.restoreOf && cur.first - v.t < SESSION_GAP) {
      cur.first = v.t;
      cur.n += v.n;
      for (const k of v.kinds) if (!cur.kinds.includes(k)) cur.kinds.push(k);
    } else out.push({ first: v.t, last: v.t, n: v.n, kinds: [...v.kinds], restoreOf: v.restoreOf });
  }
  return out;
}

async function call<T>(init?: RequestInit): Promise<T> {
  const res = await fetch('/api/history', { ...init, headers: { 'content-type': 'application/json' }, credentials: 'same-origin' });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { message?: string }).message ?? `Errore ${res.status}`);
  return body as T;
}

export function HistoryPanel({ onRestored }: { onRestored: () => Promise<void> }) {
  const [list, setList] = useState<{ from: number; sessions: Session[] }>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState(PAGE);

  const load = () =>
    call<{ from: number; versions: Version[] }>()
      .then((r) => {
        setList({ from: r.from, sessions: sessions(r.versions) });
        setError('');
      })
      .catch((e: Error) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  const restore = async (s: Session) => {
    const at = s.first - 1;
    setBusy(true);
    try {
      await onRestored(); // prima salva eventuali modifiche in sospeso
      const preview = await call<{ changed: number; counts: Record<string, number> }>({ method: 'POST', body: JSON.stringify({ at, dryRun: true }) });
      if (!preview.changed) {
        alert('I dati sono già uguali a quella versione: niente da ripristinare.');
        return;
      }
      const detail = Object.entries(preview.counts)
        .map(([k, n]) => `${n} ${KIND_LABEL[k] ?? k}`)
        .join(', ');
      const ok = confirm(
        `Riportare tutti i dati a com'erano il ${when(at)}?\n\n` +
          `Cambiano ${preview.changed} elementi (${detail}).\n` +
          `Si perdono anche le modifiche fatte dopo, da chiunque. Il ripristino si può annullare dalla stessa lista.`,
      );
      if (!ok) return;
      await call({ method: 'POST', body: JSON.stringify({ at }) });
      await onRestored();
      await load();
    } catch (e) {
      alert(`Ripristino non riuscito: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h3>Versioni precedenti</h3>
      <p className="hint">
        Ogni modifica ai dati condivisi viene registrata. In caso di errore si può riportare <b>tutto</b> (persone, disponibilità, calendario,
        parametri) a com'era prima di una sessione di modifiche. Le modifiche a pochi minuti l'una dall'altra sono raggruppate.
      </p>
      {error && <p className="login-error">{error}</p>}
      {list && list.sessions.length === 0 && <p className="muted">Nessuna modifica registrata finora.</p>}
      {list && list.sessions.length > 0 && (
        <ul className="exams versions">
          {list.sessions.slice(0, shown).map((s) => (
            <li key={s.last}>
              {when(s.first)}
              {s.last - s.first >= 60_000 && `–${time(s.last)}`} ·{' '}
              {s.restoreOf ? (
                <b>ripristino alla versione del {when(s.restoreOf)}</b>
              ) : (
                <>
                  {s.n} {s.n === 1 ? 'modifica' : 'modifiche'} · {s.kinds.map((k) => KIND_LABEL[k] ?? k).join(', ')}
                </>
              )}{' '}
              <button className="danger" disabled={busy} onClick={() => restore(s)}>
                {s.restoreOf ? 'Annulla il ripristino' : 'Torna a prima'}
              </button>
            </li>
          ))}
        </ul>
      )}
      {list && list.sessions.length > shown && (
        <button className="link" onClick={() => setShown(shown + PAGE)}>
          Mostra versioni più vecchie
        </button>
      )}
      {list && list.from > 0 && <p className="hint">La cronologia parte dal {when(list.from)}.</p>}
    </>
  );
}
