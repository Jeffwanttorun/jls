import {readFile,writeFile} from 'node:fs/promises';

const before=JSON.parse(await readFile(process.argv[2],'utf8'));
const after=JSON.parse(await readFile(process.argv[3],'utf8'));
const tables=Object.keys(before.tables).map(table=>({
  table,
  beforeCount:before.tables[table].count,
  afterCount:after.tables[table]?.count,
  countUnchanged:before.tables[table].count===after.tables[table]?.count,
  checksumUnchanged:before.tables[table].checksum===after.tables[table]?.checksum
}));
const result={
  passed:tables.every(item=>item.countUnchanged&&item.checksumUnchanged)&&JSON.stringify(before.places)===JSON.stringify(after.places)&&before.envSha256===after.envSha256,
  checkedAt:new Date().toISOString(),
  tables,
  allTableCountsUnchanged:tables.every(item=>item.countUnchanged),
  allTableChecksumsUnchanged:tables.every(item=>item.checksumUnchanged),
  allPlaceRowsUnchanged:JSON.stringify(before.places)===JSON.stringify(after.places),
  environmentFileUnchanged:before.envSha256===after.envSha256
};
await writeFile(process.argv[4],JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
if(!result.passed)process.exitCode=1;
