/** POST /api/logout → cancella il cookie di sessione. */
import type { Env } from './_env';
import { COOKIE, json } from './_auth';

export const onRequestPost: PagesFunction<Env> = async () =>
  json(200, { ok: true }, { 'set-cookie': `${COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax` });
