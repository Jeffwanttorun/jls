import JSZip from 'jszip';
import {createHash} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {validateContentStudio,type ContentStudioDocument} from '../../shared/content-studio.js';
import {VisitorContentError,VisitorContentStore,type VisitorImageAsset} from '../../shared/visitor-content.js';
import {openingScheduleErrors} from '../../shared/place-opening.js';

export const stableJSON=(value:unknown):string=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
export const digest=(value:unknown)=>createHash('sha256').update(stableJSON(value)).digest('hex');
const bytesHash=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
const filePattern=/^[a-f0-9]{64}\.(jpg|png|webp)$/;
const limit=200*1024*1024;
type MediaEntry={fileName:string;sha256:string;bytes:number;asset:VisitorImageAsset};
type Manifest={reservedCodes?:string[];format:'wuyishan-studio-archive';version:1;createdAt:string;draftRevision:number;documentHash:string;files:Record<string,{sha256:string;bytes:number}>;media:MediaEntry[]};
function fail(message:string):never{throw new VisitorContentError(message);}

// Preserve the full typed document, including empty optional editorial content.
export function validateTransferDocument(value:unknown,seed:ContentStudioDocument):asserts value is ContentStudioDocument{
 const walk=(item:any,template:any,path:string)=>{
  if(template===null){if(item!==null&&typeof item!=='string')fail(`${path} 格式错误`);return;}
  if(Array.isArray(template)){if(!Array.isArray(item))fail(`${path} 必须是列表`);if(template.length)for(const entry of item)walk(entry,template[0],path);return;}
  if(typeof template==='object'){
   if(!item||Array.isArray(item)||typeof item!=='object')fail(`${path} 格式错误`);
   for(const key of Object.keys(item))if(['__proto__','constructor','prototype'].includes(key))fail('包含不安全字段');
   for(const key of Object.keys(template)){if(!(key in item))fail(`${path}.${key} 缺失`);walk(item[key],template[key],`${path}.${key}`);}return;
  }
  if(typeof item!==typeof template||typeof item==='number'&&!Number.isFinite(item))fail(`${path} 格式错误`);
 };
 const doc=value as ContentStudioDocument;
 if(!doc||doc.schemaVersion!==2||!doc.places||!Array.isArray(doc.routes)||!Array.isArray(doc.themes))fail('仅支持 V6 schemaVersion 2 内容');
 walk({...doc,places:seed.places},{...seed},'document');
 const sample=Object.values(seed.places)[0];
 for(const [id,place] of Object.entries(doc.places)){
  walk(place,sample,`place.${id}`);
  const openingErrors=openingScheduleErrors(place.openingSchedule);if(openingErrors.length)fail(`${id}：${openingErrors.join('；')}`);
  if(place.coordinateMissing!==undefined&&typeof place.coordinateMissing!=='boolean'||place.archivedAt!==undefined&&place.archivedAt!==null&&(typeof place.archivedAt!=='string'||!Number.isFinite(Date.parse(place.archivedAt))))fail(`${id} 草稿状态无效`);
  if(!/^WY-\d{4,}$/.test(id)||place.id!==id)fail(`地点编号不一致：${id}`);
  if(![20,40,60,80,100].includes(place.labelPriority))fail(`${id} 标签优先级无效`);
  if(!['official','established','translated','pinyin','pending'].includes(place.englishNameStatus)||!['yes','conditional','no','unknown'].includes(place.familySuitability)||!['allowed','used-in-person','recheck','not-recommended','prohibited','unknown'].includes(place.overnightStatus))fail(`${id} 状态值无效`);
  if(Math.abs(place.coordinates.latitude)>90||Math.abs(place.coordinates.longitude)>180)fail(`${id} 坐标范围无效`);
  if(!Array.isArray(place.photos))fail(`${id} 图片格式无效`);
  for(const photo of place.photos)if(!filePattern.test(photo.fileName)||!photo.id||!photo.alt||typeof photo.alt.zh!=='string'||typeof photo.alt.en!=='string'||!['cover','gallery'].includes(photo.role)||!Number.isFinite(photo.order))fail(`${id} 图片引用无效`);
 }
 if(stableJSON(doc.geometry)!==stableJSON(seed.geometry))fail('受保护路线 geometry 不允许修改');
 const themes=new Set(doc.themes.map(t=>t.id));
 for(const place of Object.values(doc.places))for(const id of place.themeIds)if(!themes.has(id))fail(`地点引用不存在的主题：${id}`);
 for(const route of doc.routes){
  if(!/^[a-z0-9-]+$/.test(route.slug))fail('路线路径格式无效');
  const stages=new Set<string>(),groups=new Map<string,string>();
  for(const stage of route.stages){if(stages.has(stage.id))fail('阶段编号重复');stages.add(stage.id);for(const group of stage.groups){if(!group.id||groups.has(group.id))fail('分组编号重复');groups.set(group.id,stage.id);if(!group.title||typeof group.title.zh!=='string'||typeof group.title.en!=='string'||!group.summary||typeof group.summary.zh!=='string'||typeof group.summary.en!=='string'||typeof group.published!=='boolean'||typeof group.visible!=='boolean'||!Number.isFinite(group.order))fail('分组格式无效');}}
  for(const stage of route.stages)for(const group of stage.groups)walk(group,{id:'',title:{zh:'',en:''},summary:{zh:'',en:''},order:0,published:false,visible:true,archivedAt:null},'group');
  for(const m of route.memberships){if(!doc.places[m.placeId]||!stages.has(m.stageId)||m.groupId&&groups.get(m.groupId)!==m.stageId)fail('地点、阶段、分组关系不一致');if(!['core-stop','secondary-stop','observation','service','junction','food'].includes(m.role))fail('路线角色无效');}
  if(route.geometryRouteIds.some(id=>!seed.routes.flatMap(r=>r.geometryRouteIds).includes(id)))fail('路线引用未知 geometry');
 }
 for(const item of [...Object.values(doc.places),...doc.routes,doc.siteSettings])for(const list of ('socialLinks' in item?[item.socialLinks]:[item.videos,item.storyLinks,item.researchLinks]))for(const link of list){if(!link.id||!link.title||typeof link.title.zh!=='string'||typeof link.title.en!=='string')fail('相关链接格式无效');if(link.url&&!/^https?:\/\//.test(link.url))fail('相关链接必须是 http/https 地址');}
 const errors=validateContentStudio(doc).filter(i=>i.level==='error');if(errors.length)fail(errors.map(i=>i.message).join('；'));
}

export async function exportStudioArchive(row:{draft_revision:string;draft:ContentStudioDocument;published:ContentStudioDocument|null},history:unknown[],store:VisitorContentStore,reservedCodes:string[]=[]){
 const visitor=await store.ensure(),zip=new JSZip();
 const manifest:Manifest={format:'wuyishan-studio-archive',version:1,createdAt:new Date().toISOString(),draftRevision:Number(row.draft_revision),reservedCodes:[...new Set([...reservedCodes,...Object.keys(row.draft.places),...history.flatMap((h:any)=>Object.keys(h.snapshot?.places||{}))])].sort(),documentHash:digest(row.draft),files:{},media:[]};
 const add=(name:string,bytes:Buffer)=>{zip.file(name,bytes);manifest.files[name]={sha256:bytesHash(bytes),bytes:bytes.length};};
 add('draft.json',Buffer.from(stableJSON(row.draft)));add('published.json',Buffer.from(stableJSON(row.published)));add('history.json',Buffer.from(stableJSON(history)));add('visitor-state.json',Buffer.from(stableJSON(visitor)));
 const required=new Set([...Object.values(row.draft.places),...Object.values(row.published?.places||{})].flatMap(p=>p.photos.map(f=>f.fileName)));
 const names=new Set([...required,...Object.values(visitor.media.items).map(i=>i.fileName),...(await readdir(store.mediaDir)).filter(n=>filePattern.test(n))]);
 let total=0;
 for(const name of [...names].sort()){
  if(!filePattern.test(name))fail('图片引用无效');let bytes:Buffer;
  try{bytes=await readFile(resolve(store.mediaDir,name));}catch{try{bytes=await readFile(resolve(store.seedMediaDir,name));}catch{fail(`无法完整导出：缺少图片 ${name}。请恢复原图片后重试。`);}}
  if(bytes.length>12*1024*1024||bytesHash(bytes)!==name.split('.')[0])fail(`图片校验失败：${name}`);
  total+=bytes.length;if(total>limit)fail('媒体超过 200MB，请使用完整数据库备份');
  const asset=Object.values(visitor.media.items).find(i=>i.fileName===name)||{id:name.split('.')[0],fileName:name,mimeType:({'jpg':'image/jpeg','png':'image/png','webp':'image/webp'} as const)[name.split('.')[1] as 'jpg'],originalName:name,uploadedAt:manifest.createdAt};
  add(`media/${name}`,bytes);manifest.media.push({fileName:name,sha256:bytesHash(bytes),bytes:bytes.length,asset});
 }
 zip.file('manifest.json',JSON.stringify(manifest,null,2));return zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:3}});
}

export async function readStudioArchive(bytes:Buffer,seed:ContentStudioDocument){
 if(!bytes.length||bytes.length>limit)fail('导入包必须在 200MB 以内');
 let zip:JSZip;try{zip=await JSZip.loadAsync(bytes);}catch{fail('不是有效的 ZIP 导出包');}
 const entries=Object.values(zip.files);if(entries.length>5000)fail('导入文件数量过多');
 let size=0;for(const entry of entries){const declared=(entry as any)._data?.uncompressedSize||0;size+=declared;if(size>limit||declared>20*1024*1024)fail('解压后内容过大');if(entry.name.includes('..')||entry.name.startsWith('/')||(entry as any).unsafeOriginalName&&(entry as any).unsafeOriginalName!==entry.name)fail('不安全的 ZIP 路径');}
 const text=await zip.file('manifest.json')?.async('string');if(!text)fail('缺少导出清单');let manifest:Manifest;try{manifest=JSON.parse(text);}catch{fail('导出清单损坏');}
 if(manifest.format!=='wuyishan-studio-archive'||manifest.version!==1||!manifest.files||!Array.isArray(manifest.media))fail('不支持的导出包格式');
 if(manifest.reservedCodes&&(!Array.isArray(manifest.reservedCodes)||manifest.reservedCodes.some(code=>!/^WY-\d{4,}$/.test(code))))fail('编号占用清单无效');
 const files=new Map<string,Buffer>();
 for(const [name,expected] of Object.entries(manifest.files)){if(!['draft.json','published.json','history.json','visitor-state.json'].includes(name)&&!/^media\/[a-f0-9]{64}\.(jpg|png|webp)$/.test(name))fail('导出包含未知文件');const file=zip.file(name);if(!file)fail(`缺少文件 ${name}`);const content=await file.async('nodebuffer');if(content.length!==expected.bytes||bytesHash(content)!==expected.sha256)fail(`文件校验失败：${name}`);files.set(name,content);}
 let document:ContentStudioDocument;try{document=JSON.parse(files.get('draft.json')!.toString('utf8'));}catch{fail('草稿 JSON 损坏');}
 validateTransferDocument(document,seed);if(digest(document)!==manifest.documentHash)fail('草稿摘要不一致');
 for(const m of manifest.media){const buffer=files.get(`media/${m.fileName}`);if(!filePattern.test(m.fileName)||!buffer||bytesHash(buffer)!==m.sha256||m.sha256!==m.fileName.split('.')[0]||buffer.length!==m.bytes||m.asset.fileName!==m.fileName||m.asset.id!==m.sha256)fail('图片清单不一致');}
 for(const p of Object.values(document.places))for(const photo of p.photos)if(!manifest.media.some(m=>m.fileName===photo.fileName))fail(`缺少地点图片：${photo.fileName}`);
 return {manifest,document,files,archiveHash:bytesHash(bytes)};
}
