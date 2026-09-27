import 'dotenv/config';
import pg from 'pg';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
export async function migrate() {
 const c = await pool.connect();
 try {
  await c.query('SELECT pg_advisory_lock(91724002)');
  await c.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
  for (const name of (await readdir('database/migrations')).filter(n=>n.endsWith('.sql')).sort()) {
   const sql = await readFile(`database/migrations/${name}`,'utf8');
   const sha = createHash('sha256').update(sql).digest('hex');
   const previous = await c.query('SELECT sha256 FROM schema_migrations WHERE name=$1',[name]);
   if(previous.rowCount) { if(previous.rows[0].sha256!==sha) throw Error(`Applied migration changed: ${name}`); continue; }
   await c.query('BEGIN');
   try { await c.query(sql); await c.query('INSERT INTO schema_migrations(name,sha256) VALUES($1,$2)',[name,sha]); await c.query('COMMIT'); }
   catch(e) { await c.query('ROLLBACK'); throw e; }
  }
 } finally { await c.query('SELECT pg_advisory_unlock(91724002)'); c.release(); }
}
