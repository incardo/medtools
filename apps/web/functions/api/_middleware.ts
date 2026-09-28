/**
 * Controllo di accesso per tutte le API: serve una sessione valida (password condivisa, vedi _auth.ts).
 * Senza password configurata le API rispondono 503: meglio nessun dato che dati personali esposti.
 * In locale (`wrangler pages dev`) si può saltare il controllo con DEV_NO_AUTH=1 in `.dev.vars`.
 */
import type { Env } from './_env';
import { json, validSession } from './_auth';

const PUBLIC = new Set(['/api/login', '/api/logout']);

export const onRequest: PagesFunction<Env> = async (ctx) => {
  const { env, request } = ctx;
  if (env.DEV_NO_AUTH === '1' || PUBLIC.has(new URL(request.url).pathname)) return ctx.next();
  if (!env.APP_PASSWORD) {
    return json(503, { error: 'not-configured', message: 'Password di accesso non ancora impostata: i dati condivisi sono disattivati.' });
  }
  if (!(await validSession(request, env))) return json(401, { error: 'login', message: 'Serve la password di accesso.' });
  return ctx.next();
};
