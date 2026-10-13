import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {access,realpath,readdir} from 'node:fs/promises';import {constants} from 'node:fs';import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';
const exec=promisify(execFile);
// Read-only deployment diagnostics through the already authenticated publisher.
// Never print environment values, connection strings, passwords or draft content.
export async function auditExistingRuntime(siteRoot){
 if(process.platform!=='linux'||process.env.LOCAL_CONTENT_ONLY==='1')return {readOnly:true,skipped:'Not a production Linux publisher'};
 const phaseRoot=resolve(siteRoot,'../wuyishan-map-phase1'),result={readOnly:true,phaseRoot};
 try{const {stdout}=await exec('systemctl',['show','localdad-api','-p','WorkingDirectory','-p','MainPID','-p','User','-p','Restart','-p','ActiveState'],{timeout:5000});result.service=Object.fromEntries(stdout.trim().split('\n').map(line=>{const i=line.indexOf('=');return[line.slice(0,i),line.slice(i+1)];}));result.serviceSourceMatches=await realpath(result.service.WorkingDirectory)===await realpath(phaseRoot);}catch{result.serviceInspectionUnavailable=true;}
 try{await access('/srv/localdad/admin',constants.W_OK);result.adminDirectoryWritable=true;}catch{result.adminDirectoryWritable=false;}
 result.serviceRestartAuthorized=process.getuid()===0;
 if(!result.serviceRestartAuthorized)try{await exec('sudo',['-n','-l','/usr/bin/systemctl','restart','localdad-api'],{timeout:5000});result.serviceRestartAuthorized=true;}catch{}
 try{result.sourceMigrations=(await readdir(resolve(phaseRoot,'database/migrations'))).filter(n=>n.endsWith('.sql')).sort();}catch{result.sourceMigrationsUnavailable=true;}
 if(process.env.DATABASE_URL){let pool;try{const {default:pg}=await import(pathToFileURL(resolve(phaseRoot,'node_modules/pg/lib/index.js')).href);pool=new pg.Pool({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:5000});const client=await pool.connect();try{await client.query('BEGIN READ ONLY');result.appliedMigrations=(await client.query('SELECT name FROM schema_migrations ORDER BY name')).rows.map(r=>r.name);result.databaseRole=(await client.query('SELECT rolcreatedb,rolsuper FROM pg_roles WHERE rolname=current_user')).rows[0];result.studioTables=(await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN ('content_workspaces','content_revision_history','studio_place_codes') ORDER BY tablename")).rows.map(r=>r.tablename);await client.query('ROLLBACK');}finally{client.release();}}catch{result.databaseInspectionUnavailable=true;}finally{await pool?.end();}}
 else result.databaseConnectionNotConfigured=true;
 return result;
}
