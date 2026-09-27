import 'dotenv/config';import {test} from 'node:test';import assert from 'node:assert/strict';import pg from 'pg';import {randomUUID} from 'node:crypto';import {readFile,writeFile,rm,readdir} from 'node:fs/promises';import {resolve} from 'node:path';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
test('备份写到一半失败保留上一次完整文件，清理临时文件并退出',async()=>{
 const name='wymap_backup_audit_'+randomUUID().replaceAll('-',''),admin=new pg.Pool({connectionString:process.env.DATABASE_URL});await admin.query('CREATE DATABASE '+name);
 const url=new URL(process.env.DATABASE_URL!);url.pathname='/'+name;
 const prefix='reports/phase2/final-audit/'+name,hook=prefix+'.cjs',output=prefix+'.sql',original='previous complete backup fixture';
 try{
  await writeFile(output,original);
  await writeFile(hook,`const cp=require('node:child_process'),fs=require('node:fs'),original=cp.execFile;cp.execFile=function(file,args,options,callback){if(/pg_dump(?:\\.exe)?$/.test(file)){fs.writeFileSync(args[args.indexOf('--file')+1],'partial failed dump');setImmediate(()=>callback(new Error('isolated injected dump failure'),'',''));return;}return original.apply(this,arguments);};require('node:module').syncBuiltinESMExports();`);
  await assert.rejects(promisify(execFile)(process.execPath,['--require',resolve(hook),'--import','tsx','scripts/backup-verify.ts','--out',output],{env:{...process.env,DATABASE_URL:url.toString()},timeout:10000}),/isolated injected dump failure/);
  assert.equal(await readFile(output,'utf8'),original);assert(!(await readdir('reports/phase2/final-audit')).some(f=>f.startsWith(name+'.sql.pending-')));
  await writeFile('reports/phase2/final-audit/backup-failure-check.json',JSON.stringify({passed:true,database:name,at:new Date().toISOString(),injected:'pg_dump wrote partial content then failed',previousBackupUnchanged:true,pendingFilesRemoved:true,processExited:true},null,2));
 }finally{await rm(hook,{force:true});await rm(output,{force:true});await admin.query('DROP DATABASE '+name+' WITH (FORCE)');await admin.end();}
});
