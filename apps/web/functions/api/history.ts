/**
 * Versioni precedenti dei dati condivisi, ricostruite dalla cronologia delle scritture (tabella kv_log).
 *
 * GET  /api/history  → ultime scritture raggruppate per istante (quanti record, di che tipo) e `from`,
 *                      il primo istante da cui la cronologia è completa.
 * POST /api/history  { at, dryRun? }  → riporta ogni record al valore che aveva all'istante `at`.
 *                      Il ripristino è una scrittura come le altre (arriva a tutti con la sincronizzazione)
 *                      e finisce in cronologia: si può annullare ripristinando a prima del ripristino.
 */
import type { Env } from './_env';
import { json } from './_auth';
import { writeOps } from './data';

type Ctx = Parameters<PagesFunction<Env>>[0];

const DAYS = 90;
const kindOf = (k: string) => k.slice(0, k.indexOf(':'));

/** Prima di questo istante la cronologia non c'era: i valori più vecchi non sono noti. */
async function historyStart(env: Env): Promise<number> {
  const { results } = await env.DB.prepare("SELECT MAX(t) AS t FROM kv_log WHERE note = 'base'").all<{ t: number | null }>();
  return results[0]?.t ?? 0;
}

export async function onRequestGet({ env }: Ctx) {
  const from = Math.max(await historyStart(env), Date.now() - DAYS * 86_400_000);
  const { results } = await env.DB.prepare(
    `SELECT t, COUNT(*) AS n, GROUP_CONCAT(DISTINCT substr(k, 1, instr(k, ':') - 1)) AS kinds, MAX(note) AS note
     FROM kv_log WHERE t > ?1 GROUP BY t ORDER BY t DESC LIMIT 2000`,
  )
    .bind(from)
    .all<{ t: number; n: number; kinds: string; note: string | null }>();
  return json(200, {
    from,
    versions: results.map((r) => ({
      t: r.t,
      n: r.n,
      kinds: r.kinds.split(','),
      restoreOf: r.note?.startsWith('restore:') ? Number(r.note.slice(8)) : undefined,
    })),
  });
}

export async function onRequestPost({ request, env }: Ctx) {
  const { at, dryRun } = (await request.json().catch(() => ({}))) as { at?: unknown; dryRun?: unknown };
  if (typeof at !== 'number' || !Number.isFinite(at)) return json(400, { error: 'bad-at' });
  if (at < (await historyStart(env))) return json(400, { error: 'too-old', message: 'La cronologia non arriva così indietro.' });

  // Valore di ogni record all'istante `at` (ultima scrittura con t <= at) e valore attuale.
  const past = await env.DB.prepare(
    'SELECT l.k, l.v FROM kv_log l JOIN (SELECT k, MAX(id) AS id FROM kv_log WHERE t <= ?1 GROUP BY k) m ON l.id = m.id',
  )
    .bind(at)
    .all<{ k: string; v: string | null }>();
  const current = await env.DB.prepare('SELECT k, v FROM kv').all<{ k: string; v: string | null }>();

  const then = new Map(past.results.map((r) => [r.k, r.v]));
  const ops: { k: string; v: string | null }[] = [];
  for (const { k, v } of current.results) {
    const old = then.get(k) ?? null; // record nato dopo `at` → va cancellato
    if (old !== v) ops.push({ k, v: old });
  }

  const counts: Record<string, number> = {};
  for (const op of ops) counts[kindOf(op.k)] = (counts[kindOf(op.k)] ?? 0) + 1;
  if (!dryRun && ops.length) await writeOps(env, ops, Date.now(), `restore:${at}`);
  return json(200, { changed: ops.length, counts });
}
