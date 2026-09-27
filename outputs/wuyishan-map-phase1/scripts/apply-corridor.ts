import 'dotenv/config';
import pg from 'pg';import {readFile,writeFile} from 'node:fs/promises';
import {applyCorridorData} from '../backend/src/corridor-data.js';
const db=new pg.Pool({connectionString:process.env.DATABASE_URL});
try{
 const args=process.argv.slice(2);if(!args.includes('--apply'))throw Error('需要显式 --apply；落库前必须完成备份与人工顺序确认');
 const backup=JSON.parse(await readFile('reports/phase2/corridor/before-backup-check.json','utf8'));
 if(!backup.passed)throw Error('落库前备份恢复校验未通过');
 const result=await applyCorridorData(db,JSON.parse(await readFile('reports/phase2/corridor/before.json','utf8')),args.includes('--approved-map-roles'));
 await writeFile('reports/phase2/corridor/applied.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await db.end();}
