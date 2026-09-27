import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { pool,migrate } from './db.js';
import { preview,snapshot,apply,type Plan } from './importer.js';
import { checkDatabase } from './checks.js';
const [command,...args]=process.argv.slice(2);
const option=(name:string,fallback:string)=>{const i=args.indexOf(name);return i>=0?args[i+1]:fallback;};
const source=option('--file','sources/武夷山奶爸地图_主数据库_V1.2.xlsx');
await mkdir('reports',{recursive:true});
try {
 if(command==='migrate'){await migrate();console.log('数据库迁移完成');}
 else if(command==='preview'){
  const p=await preview(source,await snapshot(pool));
  const output=option('--out','reports/import-preview.json');await writeFile(output,JSON.stringify(p,null,2));
  const lines=['# Excel 导入预览','',`源文件：${source}`,`SHA256：${p.sourceSha256}`,`预览摘要：${p.digest}`,'',`共 ${p.summary.total} 行，可导入 ${p.summary.ready}，失败 ${p.summary.failed}，跳过 ${p.summary.skipped}，警告 ${p.summary.warnings} 条。`,'','|工作表|Excel 行|业务编号|操作|错误/警告|','|---|---:|---|---|---|',...p.rows.map(r=>`|${r.sheet}|${r.row}|${r.code}|${r.action}|${r.issues.map(i=>`${i.level}: ${i.field} ${i.message}`).join('；').replaceAll('|','/')}|`),...p.sheetIssues.map(i=>`\n表级错误：${i.field} ${i.message}`)];
  await writeFile(output.replace(/\.json$/,'.md'),lines.join('\n'));
  console.log(JSON.stringify({output,digest:p.digest,summary:p.summary,sheetIssues:p.sheetIssues},null,2));
 } else if(command==='apply'){
  const approved=JSON.parse(await readFile(option('--preview','reports/import-preview.json'),'utf8')) as Plan;
  const result=await apply(pool,approved,source);
  const output=option('--out','reports/import-result.json');await writeFile(output,JSON.stringify(result,null,2));
  console.log(JSON.stringify({output,...result.counts,jobId:result.jobId},null,2));
 } else if(command==='check'){
  const result=await checkDatabase(pool);await writeFile(option('--out','reports/database-checks.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));if(!result.passed)process.exitCode=1;
 } else {throw Error('命令：migrate | preview [--file PATH --out PATH] | apply --preview PATH [--file PATH --out PATH] | check');}
} catch(e) {console.error((e as Error).message);process.exitCode=1;} finally {await pool.end();}
