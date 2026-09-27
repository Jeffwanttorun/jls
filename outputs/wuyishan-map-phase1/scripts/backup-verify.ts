import 'dotenv/config';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { mkdir,writeFile,readFile,rename,rm } from 'node:fs/promises';
import { createHash,randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import pg from 'pg';
const exec=promisify(execFile),url=new URL(process.env.DATABASE_URL!);
const env={...process.env,PGHOST:url.hostname,PGPORT:url.port||'5432',PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password),PGDATABASE:url.pathname.slice(1)};
const bin=process.env.PG_BIN;const tool=(name:string)=>bin?resolve(bin,process.platform==='win32'?`${name}.exe`:name):name;
await mkdir('database/seed',{recursive:true});
const args=process.argv.slice(2),option=(name:string,fallback:string)=>args.includes(name)?args[args.indexOf(name)+1]:fallback;
const output=option('--out','database/seed/phase2-full.sql');
const db=new pg.Pool({connectionString:url.toString()});
const snapshot=await db.connect(),staged=output+'.pending-'+randomUUID()+'.sql';
const name=`wymap_restore_${randomUUID().replaceAll('-','')}`;
let created=false,restored:pg.Pool|undefined;
try{
 await snapshot.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 const exported=(await snapshot.query('SELECT pg_export_snapshot() value')).rows[0].value;
 await exec(tool('pg_dump'),['--no-owner','--no-privileges','--snapshot',exported,'--file',staged],{env});
 await db.query(`CREATE DATABASE ${name}`);created=true;
 url.pathname='/'+name;restored=new pg.Pool({connectionString:url.toString()});
 await exec(tool('psql'),['-X','-v','ON_ERROR_STOP=1','-f',staged],{env:{...env,PGDATABASE:name},maxBuffer:8*1024*1024});
 const tables=(await snapshot.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename<>'spatial_ref_sys' ORDER BY tablename")).rows.map(r=>r.tablename as string);
 const results=[];
 for(const table of tables){
  if(!/^[a-z_]+$/.test(table))throw Error('Unexpected table identifier');
  const sql=`SELECT count(*)::int count,md5(string_agg(row_to_json(t)::text,E'\\n' ORDER BY row_to_json(t)::text)) checksum FROM ${table} t`;
  const a=(await snapshot.query(sql)).rows[0],b=(await restored.query(sql)).rows[0];
  results.push({table,source:a,restored:b,passed:JSON.stringify(a)===JSON.stringify(b)});
 }
 const report={passed:results.every(r=>r.passed),backup:output,backupSha256:createHash('sha256').update(await readFile(staged)).digest('hex'),tables:results,checkedAt:new Date().toISOString()};
 if(!report.passed)throw Error('Backup restore mismatch; previous backup was preserved');
 // Publish only a complete backup already restored and verified against the same snapshot.
 await rename(staged,output);
 await writeFile(option('--report','reports/phase2/backup-restore-check.json'),JSON.stringify(report,null,2));
 console.log(`备份及空库恢复通过：${results.length} 张表逐表数量和内容摘要一致`);
}finally{
 try{await restored?.end();if(created)await db.query(`DROP DATABASE ${name} WITH (FORCE)`);}
 finally{await snapshot.query('ROLLBACK');snapshot.release();await db.end();await rm(staged,{force:true});}
}
