import 'dotenv/config';import pg,{type PoolClient,type Pool} from 'pg';import assert from 'node:assert/strict';import {randomUUID,createHash} from 'node:crypto';import {readFile,writeFile,readdir} from 'node:fs/promises';import {resolve} from 'node:path';import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {checkDatabase} from '../backend/src/checks.js';
const exec=promisify(execFile),root='reports/phase2/final-audit',source=new URL(process.env.DATABASE_URL!),admin=new pg.Pool({connectionString:source.toString()});
const env={...process.env,PGHOST:source.hostname,PGPORT:source.port||'5432',PGUSER:decodeURIComponent(source.username),PGPASSWORD:decodeURIComponent(source.password),PGDATABASE:source.pathname.slice(1)};
const tool=(name:string)=>process.env.PG_BIN?resolve(process.env.PG_BIN,process.platform==='win32'?name+'.exe':name):name;
const schemaQueries={
 columns:`SELECT table_name,column_name,ordinal_position,data_type,udt_name,is_nullable,column_default,is_generated,generation_expression FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position`,
 constraints:`SELECT c.relname table_name,p.conname,p.contype,p.condeferrable,p.condeferred,p.convalidated,pg_get_constraintdef(p.oid) definition FROM pg_constraint p JOIN pg_class c ON c.oid=p.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' ORDER BY c.relname,p.conname`,
 indexes:`SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname`,
 triggers:`SELECT c.relname,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid) definition FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal ORDER BY c.relname,t.tgname`,
 views:`SELECT viewname,definition FROM pg_views WHERE schemaname='public' ORDER BY viewname`,
 enums:`SELECT t.typname,e.enumlabel,e.enumsortorder FROM pg_type t JOIN pg_enum e ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' ORDER BY t.typname,e.enumsortorder`,
 functions:`SELECT p.proname,pg_get_function_identity_arguments(p.oid) args,pg_get_functiondef(p.oid) definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f' AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e') ORDER BY p.proname,args`,
 extensions:`SELECT extname,extversion FROM pg_extension ORDER BY extname`,
};
async function inspect(db:Pool|PoolClient){
 const tables:Record<string,any>={},schema:Record<string,any>={};
 for(const {tablename} of (await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows){assert.match(tablename,/^[a-z_]+$/);tables[tablename]=(await db.query(`SELECT count(*)::int count,md5(string_agg(row_to_json(t)::text,E'\n' ORDER BY row_to_json(t)::text)) checksum FROM ${tablename} t`)).rows[0];}
 for(const [name,sql] of Object.entries(schemaQueries))schema[name]=(await db.query(sql)).rows;
 schema.sequences=(await db.query("SELECT sequencename,data_type,start_value,min_value,max_value,increment_by,cycle,cache_size,last_value FROM pg_sequences WHERE schemaname='public' ORDER BY sequencename")).rows;
 return {tables,schema};
}
async function isolated<T>(label:string,fn:(db:Pool,name:string,url:URL)=>Promise<T>){const name='wymap_audit_'+randomUUID().replaceAll('-','');assert.notEqual(name,source.pathname.slice(1));await admin.query('CREATE DATABASE '+name);const url=new URL(source);url.pathname='/'+name;const db=new pg.Pool({connectionString:url.toString()});try{return await fn(db,name,url);}finally{await db.end();assert.match(name,/^wymap_audit_[a-f0-9]{32}$/);await admin.query('DROP DATABASE '+name+' WITH (FORCE)');console.log(label+'：隔离库已清理');}}
async function restore(name:string,file:string){await exec(tool('psql'),['-X','-v','ON_ERROR_STOP=1','-f',file],{env:{...env,PGDATABASE:name},maxBuffer:16*1024*1024});}
async function upgrade(url:URL){await exec(process.execPath,['--import','tsx','backend/src/cli.ts','migrate'],{env:{...process.env,DATABASE_URL:url.toString()},maxBuffer:4*1024*1024});}
const snapshot=await admin.connect();
try{
 await snapshot.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 const exported=(await snapshot.query('SELECT pg_export_snapshot() value')).rows[0].value;
 const before=await inspect(snapshot),backup='database/seed/phase2-final-audit-full.sql';
 await exec(tool('pg_dump'),['--no-owner','--no-privileges','--snapshot',exported,'--file',backup],{env,maxBuffer:16*1024*1024});
 const realChecks=await checkDatabase(admin);assert(realChecks.passed);
 const realState={at:new Date().toISOString(),checks:realChecks,structure:before.schema,
  runtime:(await snapshot.query("SELECT version() version,current_setting('listen_addresses') listen_addresses,current_setting('port') port")).rows,
  roles:(await snapshot.query('SELECT rolname,rolsuper,rolcreatedb,rolcanlogin FROM pg_roles WHERE rolname=current_user')).rows,
  deleted:(await snapshot.query('SELECT code,name,deleted_at,parent_place_id,corridor_order FROM places WHERE deleted_at IS NOT NULL ORDER BY code')).rows,
  duplicate:(await snapshot.query('SELECT p.code,p.name,q.code canonical,p.corridor_order FROM places p JOIN places q ON q.id=p.duplicate_of_place_id ORDER BY p.code')).rows,
  parentConflicts:(await snapshot.query('SELECT p.code,q.code parent,q.deleted_at,q.duplicate_of_place_id FROM places p JOIN places q ON q.id=p.parent_place_id WHERE p.deleted_at IS NULL AND (q.deleted_at IS NOT NULL OR q.duplicate_of_place_id IS NOT NULL)')).rows,
  migrations:(await snapshot.query('SELECT name,sha256 FROM schema_migrations ORDER BY name')).rows};
 for(const row of realState.migrations)assert.equal(createHash('sha256').update(await readFile('database/migrations/'+row.name)).digest('hex'),row.sha256);
 await writeFile(root+'/real-structure.json',JSON.stringify(realState,null,2));
 const restored=await isolated('最新完整备份恢复',async(db,name)=>{await restore(name,backup);const result=await inspect(db);assert.deepEqual(result,before);assert((await checkDatabase(db)).passed);return {passed:true,database:name,tables:result.tables,schemaVerified:Object.keys(result.schema),backupSha256:createHash('sha256').update(await readFile(backup)).digest('hex')};});
 await snapshot.query('COMMIT');
 const upgrades=[];
 for(const file of ['database/seed/phase1-full.sql','database/seed/phase2-satellite-full.sql']){
  upgrades.push(await isolated(file,async(db,name,url)=>{
   await restore(name,file);const places=(await db.query('SELECT * FROM places ORDER BY code')).rows,stops=(await db.query('SELECT * FROM route_stops ORDER BY route_id,sequence')).rows;
   const initial=(await db.query('SELECT name FROM schema_migrations ORDER BY name')).rows.map(r=>r.name);
   await upgrade(url);assert((await checkDatabase(db)).passed);
   const after=(await db.query('SELECT * FROM places ORDER BY code')).rows;assert.equal(after.length,places.length);
   for(let i=0;i<places.length;i++)for(const key of Object.keys(places[i]))assert.deepEqual(after[i][key],places[i][key],file+':places.'+key);
   assert.deepEqual((await db.query('SELECT * FROM route_stops ORDER BY route_id,sequence')).rows,stops);
   const first=await inspect(db);await upgrade(url);assert.deepEqual(await inspect(db),first);
   const applied=(await db.query('SELECT name FROM schema_migrations ORDER BY name')).rows.map(r=>r.name);
   assert.equal(applied.length,(await readdir('database/migrations')).filter(f=>f.endsWith('.sql')).length);
   return {backup:file,database:name,initial,applied,places:places.length,allOriginalPlaceFieldsUnchanged:true,routeStopsUnchanged:true,secondMigrationRunUnchanged:true,passed:true};
  }));
 }
 await writeFile(root+'/database-verification.json',JSON.stringify({passed:true,at:new Date().toISOString(),backup,restored,upgrades,realDataTests:'All application writes were confined to randomly named isolated databases. Source used exported read-only snapshot.'},null,2));
 console.log('最新备份全部表、列、主外键、索引、触发器、视图、函数、枚举、序列核对通过；两种旧版本升级和重复迁移通过。');
}finally{await snapshot.query('ROLLBACK');snapshot.release();await admin.end();}
