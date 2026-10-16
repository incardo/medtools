/**
 * Dati condivisi dell'app, come elenco di record chiave → JSON.
 *
 * GET  /api/data?since=<ms>  → record modificati dopo `since` (anche i cancellati, con v = null) e `now`.
 * POST /api/data  { ops: [{ k, v }] }  → scrive i record (v = null cancella). Ultima scrittura vince, record per record.
 * Senza la password admin non si possono scrivere turni suggeriti (rigenerare il calendario) né assenze
 * di un mese dopo la scadenza, né bloccare/sbloccare un mese (lock:YYYY-MM) o cambiare il calendario di un mese bloccato:
 * risposta 403 { error: 'admin' }.
 * Ogni scrittura finisce anche nella cronologia (kv_log), da cui si ripristina una versione precedente (vedi history.ts).
 */
import type { Env } from './_env';
import { absenceDeadline, todayRome, validAdmin } from './_auth';

type Ctx = Parameters<PagesFunction<Env>>[0];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

const MAX_OPS = 2000;
const MAX_VALUE = 20_000;

export async function onRequestGet({ request, env }: Ctx) {
  const since = Number(new URL(request.url).searchParams.get('since') ?? 0) || 0;
  const now = Date.now();
  const { results } = await env.DB.prepare('SELECT k, v, t FROM kv WHERE t > ?1').bind(since).all<{ k: string; v: string | null; t: number }>();
  return json({ now, rows: results });
}

export async function onRequestPost({ request, env }: Ctx) {
  let body: { ops?: { k: unknown; v: unknown }[] };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad-json' }, 400);
  }
  const ops = body.ops ?? [];
  if (!Array.isArray(ops) || ops.length > MAX_OPS) return json({ error: 'bad-ops' }, 400);
  for (const op of ops) {
    if (typeof op.k !== 'string' || op.k.length > 300) return json({ error: 'bad-key' }, 400);
    if (op.v !== null && (typeof op.v !== 'string' || op.v.length > MAX_VALUE)) return json({ error: 'bad-value' }, 400);
  }
  if (!(await validAdmin(request, env))) {
    const blocked = await adminOnly(env, ops as { k: string; v: string | null }[]);
    if (blocked) return json({ error: 'admin', message: blocked }, 403);
  }
  const now = Date.now();
  await writeOps(env, ops as { k: string; v: string | null }[], now);
  return json({ now });
}

/** Motivo per cui le scritture richiedono la password admin, o null se non serve. */
async function adminOnly(env: Env, ops: { k: string; v: string | null }[]): Promise<string | null> {
  const today = todayRome();
  const months = new Set<string>();
  for (const { k, v } of ops) {
    if (k.startsWith('lock:')) return 'Bloccare o sbloccare i turni richiede la password admin.';
    if (k.startsWith('cell:') || k.startsWith('ruota:')) months.add(k.slice(k.indexOf(':') + 1, k.indexOf(':') + 8));
    if (k.startsWith('absence:') && today > absenceDeadline(k.slice(k.indexOf('|') + 1, k.indexOf('|') + 8))) {
      return 'Scadenza delle indisponibilità passata: serve la password admin.';
    }
    if (k.startsWith('cell:') && v && (JSON.parse(v) as { source?: string }).source === 'suggested') {
      return 'Generare il calendario richiede la password admin.';
    }
  }
  if (months.size) {
    const keys = [...months].map((m) => `lock:${m}`);
    const { results } = await env.DB.prepare(`SELECT k FROM kv WHERE v IS NOT NULL AND k IN (${keys.map((_, i) => `?${i + 1}`).join(',')})`)
      .bind(...keys)
      .all<{ k: string }>();
    if (results.length) return 'I turni del mese sono bloccati: solo un admin può sbloccarli.';
  }
  return null;
}

/** Scrive i record in kv e nella cronologia, a blocchi (D1 limita le istruzioni per batch). */
export async function writeOps(env: Env, ops: { k: string; v: string | null }[], now: number, note: string | null = null) {
  const put = env.DB.prepare('INSERT INTO kv (k, v, t, by) VALUES (?1, ?2, ?3, NULL) ON CONFLICT (k) DO UPDATE SET v = excluded.v, t = excluded.t, by = excluded.by');
  const log = env.DB.prepare('INSERT INTO kv_log (k, v, t, note) VALUES (?1, ?2, ?3, ?4)');
  for (let i = 0; i < ops.length; i += 50) {
    const chunk = ops.slice(i, i + 50);
    await env.DB.batch(chunk.flatMap((op) => [put.bind(op.k, op.v, now), log.bind(op.k, op.v, now, note)]));
  }
}
