import 'dotenv/config';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';import {resolve} from 'node:path';import {randomUUID,createHash} from 'node:crypto';import JSZip from 'jszip';import pg from 'pg';
import {assertLocalDatabase} from '../backend/src/local-safety.js';
if(process.env.LOCAL_CONTENT_ONLY!=='1')throw Error('Only local restore is allowed');assertLocalDatabase();
const arg=process.argv[2];if(!arg)throw Error('请指定本地 full.zip 备份文件');
const verifyOnly=process.argv.includes('--verify-only');
const zip=await JSZip.loadAsync(await readFile(resolve(arg))),manifest=JSON.parse(await zip.file('manifest.json')!.async('string'));
if(manifest.format!=='wuyishan-local-full-backup'||manifest.version!==1)throw Error('不是完整数据库备份。内容 ZIP 请在维护台导入。');
const files=new Map<string,Buffer>();for(const [name,expected] of Object.entries(manifest.files) as [string,{bytes:number;sha256:string}][]){
 if(!/^(database\.sql|database-restore-check\.json|visitor-state\.json|media\/[a-f0-9]{64}\.(jpg|png|webp)|migrations\/[a-zA-Z0-9_-]+\.sql)$/.test(name))throw Error('备份路径无效');
 const buffer=await zip.file(name)?.async('nodebuffer');if(!buffer||buffer.length!==expected.bytes||createHash('sha256').update(buffer).digest('hex')!==expected.sha256)throw Error(`备份校验失败：${name}`);files.set(name,buffer);
 if(name.startsWith('migrations/')){const actual=await readFile(resolve('database',name));if(!buffer.equals(actual))throw Error(`已有迁移文件不一致：${name}，停止恢复`);}
}
const report=JSON.parse(files.get('database-restore-check.json')!.toString());if(!report.passed)throw Error('备份没有通过恢复核对');
// Restore into a NEW database. The current database is never dropped or overwritten.
const dbName=`wymap_local_restore_${randomUUID().replaceAll('-','')}`,folder=resolve('../../work/local-hardening/restores',dbName);await mkdir(resolve(folder,'media'),{recursive:true});
const sqlPath=resolve(folder,'database.sql');await writeFile(sqlPath,files.get('database.sql')!);
const url=new URL(process.env.DATABASE_URL!),original=new pg.Pool({connectionString:url.toString()});let restored:pg.Pool|undefined;
try{
 await original.query(`CREATE DATABASE ${dbName}`);url.pathname='/'+dbName;restored=new pg.Pool({connectionString:url.toString()});
 const env={...process.env,PGHOST:url.hostname,PGPORT:url.port||'5432',PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password),PGDATABASE:dbName};
 await promisify(execFile)(resolve('../../work/runtime/pgsql/bin',process.platform==='win32'?'psql.exe':'psql'),['-X','-v','ON_ERROR_STOP=1','-f',sqlPath],{env,maxBuffer:12*1024*1024});
 for(const entry of report.tables){if(!/^[a-z_]+$/.test(entry.table))throw Error('非法表名');const actual=(await restored.query(`SELECT count(*)::int count,md5(string_agg(row_to_json(t)::text,E'\\n' ORDER BY row_to_json(t)::text)) checksum FROM ${entry.table} t`)).rows[0];if(JSON.stringify(actual)!==JSON.stringify(entry.source))throw Error(`恢复不一致：${entry.table}`);}
 await writeFile(resolve(folder,'visitor-state.json'),files.get('visitor-state.json')!);for(const [name,buffer] of files)if(name.startsWith('media/'))await writeFile(resolve(folder,name),buffer);
 if(verifyOnly){await writeFile(resolve(folder,'verified.json'),JSON.stringify({passed:true,tables:report.tables.length,media:[...files.keys()].filter(n=>n.startsWith('media/')).length,originalDatabaseUntouched:true,environmentUntouched:true,checkedAt:new Date().toISOString()},null,2));console.log(`完整备份已在新数据库恢复验证：${report.tables.length} 张表，图片摘要一致；原数据库与连接配置未改。`);}
 else{
 const envPath=resolve('.env');await copyFile(envPath,resolve(folder,'previous.env'));let config=await readFile(envPath,'utf8');
 const fields={DATABASE_URL:url.toString(),VISITOR_CONTENT_STORE_PATH:resolve(folder,'visitor-state.json').replaceAll('\\','/'),VISITOR_CONTENT_MEDIA_DIR:resolve(folder,'media').replaceAll('\\','/'),VISITOR_CONTENT_BACKUP_DIR:resolve(folder,'visitor-backups').replaceAll('\\','/'),CONTENT_STUDIO_SNAPSHOT_PATH:resolve(folder,'published.json').replaceAll('\\','/')};
 for(const [key,value] of Object.entries(fields)){const pattern=new RegExp(`^${key}=[^\\r\\n]*`,'gm');config=pattern.test(config)?config.replace(pattern,()=>`${key}=${value}`):config+`\n${key}=${value}\n`;}
 await writeFile(envPath,config);console.log(`恢复已核对，维护台切换到新本地数据库：${dbName}`);console.log(`原数据库保留；原连接配置保留在：${folder}/previous.env`);
 }
}finally{await restored?.end();if(verifyOnly)await original.query(`DROP DATABASE ${dbName} WITH (FORCE)`);await original.end();}
