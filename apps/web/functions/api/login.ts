/** POST /api/login { password } → imposta il cookie di sessione. */
import type { Env } from './_env';
import { COOKIE, SESSION_DAYS, json, makeSession, samePassword } from './_auth';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.APP_PASSWORD) return json(503, { error: 'not-configured', message: 'Password di accesso non ancora impostata.' });
  const { password } = (await request.json().catch(() => ({}))) as { password?: unknown };
  if (typeof password !== 'string' || !(await samePassword(password, env.APP_PASSWORD))) {
    // Rallenta i tentativi a raffica.
    await new Promise((r) => setTimeout(r, 1000));
    return json(401, { error: 'wrong-password', message: 'Password errata.' });
  }
  const cookie = `${COOKIE}=${await makeSession(env)}; Max-Age=${SESSION_DAYS * 86400}; Path=/; HttpOnly; Secure; SameSite=Lax`;
  return json(200, { ok: true }, { 'set-cookie': cookie });
};
