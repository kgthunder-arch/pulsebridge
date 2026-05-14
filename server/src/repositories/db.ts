import { Pool } from "pg";

import { env } from "../config/env.js";

export const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: env.databaseSsl ? { rejectUnauthorized: false } : undefined
});

export const query = <T = Record<string, unknown>>(text: string, values: unknown[] = []) =>
  pool.query<T>(text, values);

