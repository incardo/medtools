import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';

/**
 * Password admin, data solo ad alcuni: serve per generare/togliere i suggerimenti del calendario e per cambiare
 * le disponibilità di un mese dopo la scadenza. Il server la verifica e la ricontrolla a ogni scrittura (functions/api/admin.ts).
 */
export function useAdmin(enabled: boolean) {
  const [admin, setAdmin] = useState(false);
  const [asking, setAsking] = useState<string | null>(null);
  const resolve = useRef<(ok: boolean) => void>();

  useEffect(() => {
    if (!enabled) return;
    fetch('/api/admin', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : { admin: false }))
      .then((b: { admin?: boolean }) => setAdmin(!!b.admin))
      .catch(() => setAdmin(false));
  }, [enabled]);

  /** true se l'admin è già attivo o se la password inserita è giusta; false se si annulla. */
  const requireAdmin = useCallback(
    (reason: string) => {
      if (admin) return Promise.resolve(true);
      resolve.current?.(false);
      setAsking(reason);
      return new Promise<boolean>((r) => (resolve.current = r));
    },
    [admin],
  );

  const unlock = async (password: string) => {
    const res = await fetch('/api/admin', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password }) });
    if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { message?: string }).message ?? 'Password admin non accettata');
    setAdmin(true);
    setAsking(null);
    resolve.current?.(true);
    resolve.current = undefined;
  };

  const cancel = () => {
    setAsking(null);
    resolve.current?.(false);
    resolve.current = undefined;
  };

  const lock = async () => {
    await fetch('/api/admin', { method: 'DELETE' });
    setAdmin(false);
  };

  return { admin, requireAdmin, lock, prompt: asking === null ? null : <AdminPrompt reason={asking} onUnlock={unlock} onCancel={cancel} /> };
}

function AdminPrompt({ reason, onUnlock, onCancel }: { reason: string; onUnlock: (p: string) => Promise<void>; onCancel: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onUnlock(password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password admin non accettata');
      setBusy(false);
    }
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <form className="login modal" onSubmit={submit} onClick={(e) => e.stopPropagation()}>
        <h2>Password admin</h2>
        <p className="hint">{reason} Resti admin su questo browser per 30 giorni (o finché premi "Esci da admin").</p>
        <input type="password" autoFocus autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password admin" />
        <div className="modal-actions">
          <button type="button" onClick={onCancel}>
            Annulla
          </button>
          <button className="primary" disabled={busy || !password}>
            {busy ? 'Verifico…' : 'Sblocca'}
          </button>
        </div>
        {error && <p className="login-error">{error}</p>}
      </form>
    </div>
  );
}
