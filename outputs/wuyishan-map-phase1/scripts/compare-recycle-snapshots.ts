import {readFile,writeFile} from 'node:fs/promises';
const before=JSON.parse(await readFile(process.argv[2],'utf8')),after=JSON.parse(await readFile(process.argv[3],'utf8'));
const oldTables=Object.keys(before.tables).filter(table=>!['places','schema_migrations'].includes(table));
const tableResults=oldTables.map(table=>({table,unchanged:JSON.stringify(before.tables[table])===JSON.stringify(after.tables[table])}));
const strip=(p:Record<string,unknown>)=>Object.fromEntries(Object.entries(p).filter(([key])=>!['deleted_at','deleted_by','deletion_reason'].includes(key)));
const result={passed:tableResults.every(x=>x.unchanged)&&JSON.stringify(before.places.map(strip))===JSON.stringify(after.places.map(strip))&&before.envSha256===after.envSha256&&after.tables.place_recycle_history?.count===0,
 oldBusinessTables:tableResults,allExistingPlaceFieldsUnchanged:JSON.stringify(before.places.map(strip))===JSON.stringify(after.places.map(strip)),environmentFileUnchanged:before.envSha256===after.envSha256,recycleBinRows:Number(after.tables.places.count)-Number(before.tables.places.count),recycleHistoryRows:after.tables.place_recycle_history?.count,newColumns:['deleted_at','deleted_by','deletion_reason']};
await writeFile(process.argv[4],JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
if(!result.passed)process.exitCode=1;
