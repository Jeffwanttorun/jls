import JSZip from 'jszip';
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {join,relative} from 'node:path';
import {createHash} from 'node:crypto';

const archive=await JSZip.loadAsync(await readFile(process.argv[2]));
const roots=['admin','backend','shared','database/migrations'];
const current=new Map<string,string>();
async function visit(directory:string){
  for(const entry of await readdir(directory,{withFileTypes:true})){
    const path=join(directory,entry.name);
    if(entry.isDirectory()){
      if(entry.name!=='dist')await visit(path);
    }else current.set(relative('.',path).replaceAll('\\','/'),createHash('sha256').update(await readFile(path)).digest('hex'));
  }
}
for(const root of roots)await visit(root);
const archived=new Map<string,string>();
for(const [path,entry] of Object.entries(archive.files)){
  if(!entry.dir&&roots.some(root=>path===root||path.startsWith(root+'/'))){
    archived.set(path,createHash('sha256').update(await entry.async('nodebuffer')).digest('hex'));
  }
}
const reviewed=JSON.parse(await readFile(process.argv[4],'utf8'));
for(const item of reviewed.files as {path:string;sha256:string}[]){
  if(item.path.startsWith('database/migrations/'))archived.set(item.path,item.sha256);
}
const paths=[...new Set([...current.keys(),...archived.keys()])].sort();
const differences=paths.filter(path=>current.get(path)!==archived.get(path)).map(path=>({path,current:current.get(path)||null,baseline:archived.get(path)||null}));
const result={passed:differences.length===0,checkedAt:new Date().toISOString(),baseline:process.argv[2],roots,fileCount:paths.length,differences};
await writeFile(process.argv[3],JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
if(!result.passed)process.exitCode=1;
