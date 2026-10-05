import 'dotenv/config';import {readdir} from 'node:fs/promises';import pg from 'pg';import {assertLocalDatabase} from '../backend/src/local-safety.js';
if(process.env.LOCAL_CONTENT_ONLY!=='1')throw Error('Local-only mode required');assertLocalDatabase();
const db=new pg.Pool({connectionString:process.env.DATABASE_URL});let code=0;
try{const exists=(await db.query("SELECT to_regclass('public.schema_migrations') name")).rows[0].name;const applied=new Set<string>(exists?(await db.query('SELECT name FROM schema_migrations')).rows.map(r=>r.name):[]);const pending=(await readdir('database/migrations')).filter(n=>n.endsWith('.sql')&&!applied.has(n));console.log(`本地待执行迁移：${pending.length}`);if(pending.length)code=10;}finally{await db.end();}process.exit(code);
