/**
 * Password admin (vedi _auth.ts).
 * GET    /api/admin              → { admin: boolean }
 * POST   /api/admin { password } → imposta il cookie admin
 * DELETE /api/admin              → lo cancella
 */
import type { Env } from './_env';
import { ADMIN_COOKIE, SESSION_DAYS, json, makeAdmin, samePassword, validAdmin } from './_auth';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => json(200, { admin: await validAdmin(request, env) });

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.ADMIN_PASSWORD) return json(503, { error: 'not-configured', message: 'Password admin non ancora impostata.' });
  const { password } = (await request.json().catch(() => ({}))) as { password?: unknown };
  if (typeof password !== 'string' || !(await samePassword(password, env.ADMIN_PASSWORD))) {
    await new Promise((r) => setTimeout(r, 1000));
    return json(401, { error: 'wrong-password', message: 'Password admin errata.' });
  }
  const cookie = `${ADMIN_COOKIE}=${await makeAdmin(env)}; Max-Age=${SESSION_DAYS * 86400}; Path=/; HttpOnly; Secure; SameSite=Lax`;
  return json(200, { ok: true }, { 'set-cookie': cookie });
};

export const onRequestDelete: PagesFunction<Env> = async () =>
  json(200, { ok: true }, { 'set-cookie': `${ADMIN_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax` });
