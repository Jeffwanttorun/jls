import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { readFile } from 'node:fs/promises';
// ExcelJS 4.4 expects unprefixed SpreadsheetML tags. The supplied Excel uses x: tags.
// Normalize that namespace in memory only. Do not modify the original workbook or cell values.
export async function readWorkbook(file:string) {
 const zip=await JSZip.loadAsync(await readFile(file));
 const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
 for(const entry of Object.values(zip.files)){
  if(!entry.name.startsWith('xl/')||!entry.name.endsWith('.xml'))continue;
  let xml=await entry.async('string');let changed=false;
  const prefixes=[...xml.matchAll(/xmlns:([A-Za-z_][\w.-]*)="http:\/\/schemas.openxmlformats.org\/spreadsheetml\/2006\/main"/g)].map(m=>m[1]);
  for(const prefix of new Set(prefixes)){
   const safe=prefix.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
   xml=xml.replace(new RegExp(`(<\\/?)(?:${safe}):`,'g'),'$1');changed=true;
  }
  if(changed){if(!xml.includes(`xmlns="${ns}"`))xml=xml.replace(/(<[A-Za-z_][\w.-]*)(\s|>)/,`$1 xmlns="${ns}"$2`);zip.file(entry.name,xml);}
 }
 const w=new ExcelJS.Workbook();await w.xlsx.load(await zip.generateAsync({type:'nodebuffer'}) as never,{ignoreNodes:['tableParts','drawing','extLst']});return w;
}
