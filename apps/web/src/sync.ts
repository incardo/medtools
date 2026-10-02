import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react';
import { emptyData, type AppData } from './store';

/**
 * Dati condivisi tra tutti gli utenti, salvati su Cloudflare D1 tramite /api/data.
 *
 * I dati dell'app sono spezzati in record indipendenti (una persona, un'assenza, una cella del calendario, ...):
 * ogni modifica invia solo i record cambiati, così due persone che lavorano su celle diverse non si sovrascrivono.
 * Le modifiche degli altri arrivano con un controllo periodico (solo mentre la pagina è visibile).
 */

type Flat = Map<string, string>;

const POLL_MS = 8000;
const FLUSH_MS = 400;
/** Sovrapposizione tra un controllo e l'altro, per non perdere scritture con orologi leggermente diversi. */
const OVERLAP_MS = 10_000;

const enrKey = (e: AppData['enrollments'][number]) => `${e.personId}|${e.academicYear}|${e.activeFrom}`;

export function flatten(d: AppData): Flat {
  const m: Flat = new Map();
  const put = (k: string, v: unknown) => m.set(k, JSON.stringify(v));
  for (const p of d.people) put(`person:${p.id}`, p);
  for (const e of d.enrollments) put(`enrollment:${enrKey(e)}`, e);
  for (const a of d.academicYears) put(`year:${a.id}`, a);
  for (const [k, v] of Object.entries(d.absences)) put(`absence:${k}`, v);
  for (const [k, v] of Object.entries(d.monthParams)) put(`params:${k}`, v);
  for (const [month, cells] of Object.entries(d.assignments)) for (const [k, v] of Object.entries(cells)) put(`cell:${month}:${k}`, v);
  for (const [k, v] of Object.entries(d.ruotaNames ?? {})) put(`ruota:${k}`, v);
  return m;
}

export function unflatten(m: Flat): AppData {
  const d = emptyData();
  d.academicYears = [];
  for (const [k, raw] of m) {
    const i = k.indexOf(':');
    const kind = k.slice(0, i);
    const rest = k.slice(i + 1);
    const v = JSON.parse(raw);
    if (kind === 'person') d.people.push(v);
    else if (kind === 'enrollment') d.enrollments.push(v);
    else if (kind === 'year') d.academicYears.push(v);
    else if (kind === 'absence') d.absences[rest] = v;
    else if (kind === 'params') d.monthParams[rest] = v;
    else if (kind === 'cell') {
      const month = rest.slice(0, 7);
      (d.assignments[month] ??= {})[rest.slice(8)] = v;
    } else if (kind === 'ruota') d.ruotaNames![rest] = v;
  }
  d.people.sort((a, b) => a.name.localeCompare(b.name));
  d.academicYears.sort((a, b) => a.id.localeCompare(b.id));
  if (!d.academicYears.length) d.academicYears = emptyData().academicYears;
  return d;
}

export type SyncStatus =
  | { state: 'loading' }
  | { state: 'ok'; at: number }
  | { state: 'saving' }
  | { state: 'error'; message: string }
  | { state: 'login'; message: string }
  | { state: 'blocked'; message: string };

async function api<T>(init?: RequestInit, since?: number): Promise<T> {
  const res = await fetch(since === undefined ? '/api/data' : `/api/data?since=${since}`, {
    ...init,
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error((body as { message?: string }).message ?? `Errore ${res.status}`);
    (err as Error & { kind?: string }).kind = res.status === 401 ? 'login' : res.status === 503 ? 'blocked' : undefined;
    throw err;
  }
  return body as T;
}

export function useSharedData() {
  const [data, setState] = useState<AppData>(emptyData);
  const [status, setStatus] = useState<SyncStatus>({ state: 'loading' });
  const [empty, setEmpty] = useState(false);
  const flat = useRef<Flat>(new Map());
  const dataRef = useRef<AppData>(data);
  const pending = useRef(new Map<string, string | null>());
  const inFlight = useRef(new Set<string>());
  const since = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const fail = (e: unknown) => {
    const err = e as Error & { kind?: 'login' | 'blocked' };
    setStatus({ state: err.kind ?? 'error', message: err.message || 'Connessione non riuscita' });
  };

  const apply = (rows: { k: string; v: string | null }[]) => {
    let changed = false;
    for (const { k, v } of rows) {
      // Le modifiche locali non ancora confermate vincono su quello che arriva dal server.
      if (pending.current.has(k) || inFlight.current.has(k)) continue;
      if (v === null ? flat.current.delete(k) : flat.current.get(k) !== v) {
        if (v !== null) flat.current.set(k, v);
        changed = true;
      }
    }
    if (changed) {
      dataRef.current = unflatten(flat.current);
      setState(dataRef.current);
    }
  };

  const pull = useCallback(async () => {
    try {
      const res = await api<{ now: number; rows: { k: string; v: string | null }[] }>(undefined, Math.max(0, since.current - OVERLAP_MS));
      const first = since.current === 0;
      since.current = res.now;
      apply(res.rows);
      if (first) setEmpty(!res.rows.some((r) => r.v !== null));
      if (!pending.current.size && !inFlight.current.size) setStatus({ state: 'ok', at: Date.now() });
    } catch (e) {
      fail(e);
    }
  }, []);

  const flush = useCallback(async () => {
    if (!pending.current.size || inFlight.current.size) return;
    const ops = [...pending.current].map(([k, v]) => ({ k, v }));
    pending.current.clear();
    ops.forEach((o) => inFlight.current.add(o.k));
    setStatus({ state: 'saving' });
    try {
      await api({ method: 'POST', body: JSON.stringify({ ops }) });
      inFlight.current.clear();
      setStatus({ state: 'ok', at: Date.now() });
    } catch (e) {
      // Da rimandare: rimettiamo le operazioni in coda senza scavalcare modifiche più recenti.
      inFlight.current.clear();
      for (const o of ops) if (!pending.current.has(o.k)) pending.current.set(o.k, o.v);
      fail(e);
      return;
    }
    if (pending.current.size) flush();
  }, []);

  const setData = useCallback(
    (u: SetStateAction<AppData>) => {
      const next = typeof u === 'function' ? u(dataRef.current) : u;
      const nextFlat = flatten(next);
      for (const [k, v] of nextFlat) if (flat.current.get(k) !== v) pending.current.set(k, v);
      for (const k of flat.current.keys()) if (!nextFlat.has(k)) pending.current.set(k, null);
      flat.current = nextFlat;
      dataRef.current = next;
      setState(next);
      setEmpty(false);
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, FLUSH_MS);
    },
    [flush],
  );

  useEffect(() => {
    pull();
    const id = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (pending.current.size) flush();
      pull();
    }, POLL_MS);
    const onVisible = () => document.visibilityState === 'visible' && pull();
    document.addEventListener('visibilitychange', onVisible);
    const onLeave = (e: BeforeUnloadEvent) => {
      if (pending.current.size || inFlight.current.size) e.preventDefault();
    };
    window.addEventListener('beforeunload', onLeave);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('beforeunload', onLeave);
    };
  }, [pull, flush]);

  /** Accesso con la password condivisa; poi si ricarica tutto. */
  const login = useCallback(
    async (password: string) => {
      const res = await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password }) });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { message?: string }).message ?? 'Accesso non riuscito');
      since.current = 0;
      setStatus({ state: 'loading' });
      await pull();
      if (pending.current.size) flush();
    },
    [pull, flush],
  );

  const logout = useCallback(async () => {
    await fetch('/api/logout', { method: 'POST' });
    location.reload();
  }, []);

  /** Salva le modifiche in sospeso e scarica subito quelle del server (es. dopo un ripristino). */
  const refresh = useCallback(async () => {
    await flush();
    await pull();
  }, [pull, flush]);

  return { data, setData, status, empty, login, logout, refresh };
}
