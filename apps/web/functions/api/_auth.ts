/**
 * Accesso con una password condivisa tra gli specializzandi.
 * La sessione è un cookie firmato (HMAC con la password stessa): cambiando la password si scollegano tutti.
 */
import type { Env } from './_env';

export const COOKIE = 'mt_session';
export const SESSION_DAYS = 30;

const enc = new TextEncoder();
const b64url = (buf: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

async function hmac(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(msg)));
}

/** Confronto a tempo costante (tramite HMAC, così anche lunghezze diverse non trapelano). */
export async function samePassword(given: string, expected: string): Promise<boolean> {
  const [a, b] = await Promise.all([hmac('cmp', given), hmac('cmp', expected)]);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.min(a.length, b.length); i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function makeSession(env: Env): Promise<string> {
  const exp = Date.now() + SESSION_DAYS * 86_400_000;
  return `${exp}.${await hmac(env.APP_PASSWORD!, `session:${exp}`)}`;
}

export async function validSession(request: Request, env: Env): Promise<boolean> {
  const raw = request.headers.get('cookie')?.match(new RegExp(`${COOKIE}=([^;]+)`))?.[1];
  if (!raw || !env.APP_PASSWORD) return false;
  const [exp, sig] = raw.split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return (await hmac(env.APP_PASSWORD, `session:${exp}`)) === sig;
}

/**
 * Password admin (secret ADMIN_PASSWORD), data solo ad alcuni: serve per rigenerare il calendario
 * e per cambiare le disponibilità di un mese dopo la scadenza (il 15 del mese precedente).
 * Cookie separato da quello di accesso, firmato con la password admin: cambiandola si perde l'admin ovunque.
 */
export const ADMIN_COOKIE = 'mt_admin';

export async function makeAdmin(env: Env): Promise<string> {
  const exp = Date.now() + SESSION_DAYS * 86_400_000;
  return `${exp}.${await hmac(env.ADMIN_PASSWORD!, `admin:${exp}`)}`;
}

export async function validAdmin(request: Request, env: Env): Promise<boolean> {
  if (env.DEV_NO_AUTH === '1') return true;
  const raw = request.headers.get('cookie')?.match(new RegExp(`${ADMIN_COOKIE}=([^;]+)`))?.[1];
  if (!raw || !env.ADMIN_PASSWORD) return false;
  const [exp, sig] = raw.split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return (await hmac(env.ADMIN_PASSWORD, `admin:${exp}`)) === sig;
}

/** Ultimo giorno per le indisponibilità di un mese (YYYY-MM): il 15 del mese precedente. Uguale a `absenceDeadline` del motore. */
export function absenceDeadline(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${m === 1 ? y - 1 : y}-${String(m === 1 ? 12 : m - 1).padStart(2, '0')}-15`;
}

/** Oggi in Italia, YYYY-MM-DD. */
export const todayRome = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date());

export const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers } });
