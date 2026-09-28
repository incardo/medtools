/** Tipi minimi del runtime Cloudflare usati dalle funzioni (senza dipendere da @cloudflare/workers-types). */
export interface D1Result<T> {
  results: T[];
}
export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T>(): Promise<D1Result<T>>;
}
export interface D1Database {
  prepare(sql: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<unknown>;
}

export interface Env {
  DB: D1Database;
  /** Password condivisa di accesso: secret del progetto Pages (`wrangler pages secret put APP_PASSWORD`). */
  APP_PASSWORD?: string;
  DEV_NO_AUTH?: string;
}

declare global {
  type PagesFunction<E = unknown, P extends string = string, D extends Record<string, unknown> = Record<string, unknown>> = (ctx: {
    request: Request;
    env: E;
    params: Record<P, string | string[]>;
    data: D;
    next(): Promise<Response>;
  }) => Response | Promise<Response>;
}
