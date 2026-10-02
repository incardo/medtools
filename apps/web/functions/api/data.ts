/**
 * Dati condivisi dell'app, come elenco di record chiave → JSON.
 *
 * GET  /api/data?since=<ms>  → record modificati dopo `since` (anche i cancellati, con v = null) e `now`.
 * POST /api/data  { ops: [{ k, v }] }  → scrive i record (v = null cancella). Ultima scrittura vince, record per record.
 * Ogni scrittura finisce anche nella cronologia (kv_log), da cui si ripristina una versione precedente (vedi history.ts).
 */
import type { Env } from './_env';

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
  const now = Date.now();
  await writeOps(env, ops as { k: string; v: string | null }[], now);
  return json({ now });
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
