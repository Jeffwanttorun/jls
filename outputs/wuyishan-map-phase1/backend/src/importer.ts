import { readWorkbook } from './workbook.js';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { enums, type Row } from '../../shared/domain.js';
import {legacySources} from '../../shared/coordinates.js';

export type Issue = { level: 'error'|'warning'; field: string; message: string };
export type ImportRow = { sheet: string; row: number; code: string; raw: Row; data: Row; issues: Issue[]; action: 'insert'|'skip'|'error' };
export type Snapshot = { places: Record<string,string|null>; unavailablePlaces?:string[]; categories: string[]; terms: string[]; routes: string[]; guides: string[]; verifications: string[]; candidates: string[] };
export type Plan = { version: 1; source: string; sourceSha256: string; digest: string; rows: ImportRow[]; summary: ReturnType<typeof summarize>; sheetIssues: Issue[] };
export const emptySnapshot = (): Snapshot => ({places:{},categories:[],terms:[],routes:[],guides:[],verifications:[],candidates:[]});
export const specs: Record<string,{key:string; headers:string[]}> = {
 '分类标签': {key:'编码', headers:['维度','编码','名称','说明','启用']},
 '地点库': {key:'地点ID',headers:['地点ID','名称','点位层级','上级地点ID','所属区域','一级分类','二级分类/标签','公开等级','当前状态','优先级','原始纬度','原始经度','原始坐标系','坐标来源','坐标可信等级','地图纬度','地图经度','地图坐标系','是否人工核验','最后核验日期','距今核验天数','信息新鲜度','停车','厕所','适合带娃','适合老人','雨天适合','主要风险','一句话说明','关联路线','关联攻略','备注']},
 '路线库':{key:'路线ID',headers:['路线ID','路线名称','路线类型','状态','适合人群','地点序列（地点ID）','预计总时长','驾驶时长','步行距离km','推荐季节','雨天可用','起点','终点','最后核验日期','备注']},
 '攻略库':{key:'攻略ID',headers:['攻略ID','标题','内容类型','关联地点ID','关联路线ID','平台','发布状态','发布时间','最后修改','封面/素材备注','正文文件/链接','备注']},
 '实地核验':{key:'核验ID',headers:['核验ID','地点ID','地点名称','核验日期','核验人','道路','停车','厕所','开放状态','水情/自然观察','天气','现场照片索引','备注','录入时间']},
 '坐标候选匹配':{key:'候选ID',headers:['候选ID','源文件名','源类型','记录时间','时间码/记录序号','设备','原始纬度','原始经度','原始坐标系','海拔/高度','目标地点ID','目标地点名称','匹配依据','匹配置信度','地图纬度','地图经度','地图坐标系','人工确认','写回状态','备注']}
};
const hash = (value:string|Buffer) => createHash('sha256').update(value).digest('hex');
const text = (v:unknown) => v == null ? '' : String(v).trim();
const nullable = (v:unknown) => text(v) || null;
const split = (v:unknown) => text(v).split(/[→,，、;；\n]+/).map(v=>v.trim()).filter(Boolean);
function issue(r:ImportRow,field:string,message:string,level:Issue['level']='error') { if(!r.issues.some(i=>i.field===field&&i.message===message)) r.issues.push({level,field,message}); }
function required(r:ImportRow,k:string) { if(!text(r.raw[k])) issue(r,k,'缺失必填字段'); return text(r.raw[k]); }
function enumeration(r:ImportRow,k:string,allowed:readonly string[],optional=false) { const v=text(r.raw[k]); if((!v&&!optional)||(v&&!allowed.includes(v))) issue(r,k,`无效枚举：${v || '(空)'}；允许：${allowed.join('、')}`); return v||null; }
function number(r:ImportRow,k:string,min=0,max=Infinity) { const v=r.raw[k]; if(v==null||v==='')return null; if(typeof v==='boolean'||!/^[-+]?\d+(\.\d+)?$/.test(text(v))) {issue(r,k,'必须为数值');return null;} const n=Number(v); if(!Number.isFinite(n)||n<min||n>max)issue(r,k,`数值超出范围 ${min} 至 ${max}`); return n; }
function bool(r:ImportRow,k:string) { const v=r.raw[k]; if(v==null||v==='')return null; if(v===true||v===1||v==='是')return true; if(v===false||v===0||v==='否')return false; issue(r,k,'必须为 是/否 或布尔值'); return null; }
export function parseDate(value:unknown,dateOnly=false):string|null {
 if(value==null||value==='')return null;
 // Excel dates are wall-clock cells, not UTC timestamps. Read components as Asia/Shanghai.
 let s=value instanceof Date ? value.toISOString().slice(0,19) : text(value);
 const m=/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?)?$/.exec(s);
 if(!m)throw Error('日期须为 YYYY-MM-DD 或 ISO 8601 时间');
 const y=+m[1],mo=+m[2],d=+m[3],h=+(m[4]||0),mi=+(m[5]||0),sec=+(m[6]||0);
 const day=new Date(Date.UTC(y,mo-1,d));
 if(y<1900||y>9999||day.getUTCFullYear()!==y||day.getUTCMonth()!==mo-1||day.getUTCDate()!==d||h>23||mi>59||sec>59)throw Error('日期或时间不存在');
 if(dateOnly&&m[4])throw Error('此字段仅接受日期，不接受时间');
 if(dateOnly)return s.slice(0,10);
 const date=new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]||'00'}:${m[5]||'00'}:${m[6]||'00'}${m[7]||''}${m[8]||'+08:00'}`);
 if(!Number.isFinite(date.getTime()))throw Error('无效时间或时区');
 return date.toISOString();
}
function date(r:ImportRow,k:string,dateOnly=false) { try { const v=r.raw[k]; return parseDate(dateOnly&&v instanceof Date?v.toISOString().slice(0,10):v,dateOnly); } catch(e) {issue(r,k,(e as Error).message);return null;} }
function duration(r:ImportRow,k:string) { const v=text(r.raw[k]); if(!v)return null; const m=/^(\d+(?:\.\d+)?)\s*(分钟|min|小时|h)$/.exec(v); if(!m){issue(r,k,'时长需要明确单位，例如 30分钟 / 2小时；不猜测裸数字单位');return null;} return +m[1]*(['小时','h'].includes(m[2])?60:1); }
function coordinate(r:ImportRow,fromPlace:boolean) {
 const x=r.raw; const raw_latitude=number(r,'原始纬度',-90,90),raw_longitude=number(r,'原始经度',-180,180);
 const converted_latitude=number(r,'地图纬度',-90,90),converted_longitude=number(r,'地图经度',-180,180);
 const has=[raw_latitude,raw_longitude,converted_latitude,converted_longitude].some(v=>v!==null);
 if(!has&&fromPlace){ if(['原始坐标系','坐标来源','坐标可信等级','地图坐标系','是否人工核验'].some(k=>text(x[k]))) issue(r,'坐标','存在坐标元数据但无坐标数值，原值仅保留在源行','warning'); return null; }
 if(raw_latitude===null||raw_longitude===null)issue(r,'原始坐标','必须同时提供原始经纬度；不得用地图坐标冒充原始坐标');
 const system=enumeration(r,'原始坐标系',enums.coordinate_system);
 const source=enumeration(r,fromPlace?'坐标来源':'源类型',enums.source_type);
 const map_system=enumeration(r,'地图坐标系',enums.coordinate_system,true);
 if((converted_latitude===null)!==(converted_longitude===null))issue(r,'地图坐标','地图经纬度必须成对');
 if(converted_latitude!==null&&(system==='未知'||map_system!=='GCJ-02'))issue(r,'地图坐标','未知原始坐标系不能转换，地图结果只接收明确的 GCJ-02');
 const confidence=fromPlace?enumeration(r,'坐标可信等级',enums.confidence_level,true):null;
 const claim=bool(r,fromPlace?'是否人工核验':'人工确认');
 if(claim)issue(r,'人工确认','Excel 确认标记缺少确认人/确认时间审计凭证，仅保留来源声明；候选保持未确认','warning');
 const source_time=fromPlace?null:date(r,'记录时间');
 if(!source_time)issue(r,'记录时间','缺少原始采集时间；保留空值，不用文件修改时间代替','warning');
 if(system==='未知')issue(r,'原始坐标系','未知坐标系仅保留原始候选，不允许导航','warning');
 if(!fromPlace) { required(r,'源文件名'); enumeration(r,'匹配置信度',enums.match_confidence,true); enumeration(r,'写回状态',enums.writeback_status,true); }
 return {code:fromPlace?`EXCEL-${r.code}`:r.code,source_file:fromPlace?'武夷山奶爸地图_主数据库_V1.2.xlsx':text(x['源文件名']),source_type:source,source_time,source_time_original:fromPlace?null:nullable(x['记录时间']),
 timecode:nullable(x['时间码/记录序号']),device:nullable(x['设备']),altitude_m:fromPlace?null:number(r,'海拔/高度',-12000,100000),
 raw_latitude,raw_longitude,raw_coordinate_system:system,confidence_level:confidence,converted_latitude,converted_longitude,map_coordinate_system:map_system,
 matched_code:fromPlace?r.code:nullable(x['目标地点ID']),match_confidence:fromPlace?null:nullable(x['匹配置信度']),match_reason:nullable(x['匹配依据']),
 source_claimed_confirmed:claim,human_confirmed:false,writeback_status:'待确认',notes:nullable(x['备注'])};
}
export function normalize(r:ImportRow) {
 const x=r.raw,n=(k:string)=>nullable(x[k]);
 switch(r.sheet) {
 case '分类标签': r.code=`${required(r,'维度')}:${required(r,'编码')}`; r.data={dimension:text(x['维度']),code:text(x['编码']),name:required(r,'名称'),description:n('说明'),enabled:bool(r,'启用')};
  if(!['点位层级','一级分类','公开等级','坐标可信','当前状态','任务状态','任务优先级','标签'].includes(text(x['维度'])))issue(r,'维度','未知分类维度');
  if(r.data.enabled===null)issue(r,'启用','缺少启用标记'); break;
 case '地点库': {
  r.code=required(r,'地点ID'); if(!/^WY-\d{4,}$/.test(r.code))issue(r,'地点ID','格式须为 WY-0001，保留业务编号');
  r.data={code:r.code,name:required(r,'名称'),place_type:enumeration(r,'点位层级',enums.place_type),parent_code:n('上级地点ID'),category:required(r,'一级分类'),tags:text(x['二级分类/标签']).split('/').filter(Boolean),region:n('所属区域'),public_level:enumeration(r,'公开等级',enums.public_level),current_status:enumeration(r,'当前状态',enums.current_status),priority:enumeration(r,'优先级',enums.priority),intro:n('一句话说明'),notes:n('备注'),risk_note:n('主要风险'),rain_friendly:enumeration(r,'雨天适合',enums.yes_partial,true),source_last_verified_at:date(r,'最后核验日期',true),parking_available:enumeration(r,'停车',enums.yes_partial,true),toilet_available:enumeration(r,'厕所',enums.yes_partial,true),child_friendly_note:enumeration(r,'适合带娃',enums.yes_partial,true),elderly_friendly:enumeration(r,'适合老人',enums.yes_partial,true),route_codes:split(x['关联路线']),guide_codes:split(x['关联攻略'])};
  number(r,'距今核验天数'); enumeration(r,'信息新鲜度',['待核验','新鲜','建议复核','已过期'],true);
  r.data.coordinate=coordinate(r,true);
  if(!r.data.coordinate)issue(r,'坐标','缺少坐标，地点可导入但不可导航','warning');
  if(!r.data.source_last_verified_at)issue(r,'最后核验日期','无核验日期，不能认定当前信息已实地核验','warning');
  if(r.data.place_type==='辅助点'&&!r.data.parent_code)issue(r,'上级地点ID','辅助点未指定父地点，保持独立，不推测关联','warning');
  if(r.data.category==='自然观察'&&r.data.public_level==='P1')issue(r,'公开等级','自然观察 P1 需人工复核生态敏感性；本批无正式坐标，不自动发布','warning');
  break;
 }
 case '路线库':
  r.code=required(r,'路线ID'); if(!/^R-\d{4,}$/.test(r.code))issue(r,'路线ID','格式须为 R-0001');
  r.data={code:r.code,name:required(r,'路线名称'),route_type:enumeration(r,'路线类型',enums.route_type),source_status:enumeration(r,'状态',enums.current_status),publish_status:'草稿',suitable_age_note:n('适合人群'),stops:split(x['地点序列（地点ID）']),total_duration_min:duration(r,'预计总时长'),estimated_driving_min:duration(r,'驾驶时长'),estimated_walking_m:number(r,'步行距离km')===null?null:Number(x['步行距离km'])*1000,season_note:n('推荐季节'),rain_friendly:enumeration(r,'雨天可用',enums.yes_partial,true),start_note:n('起点'),end_note:n('终点'),source_last_verified_at:date(r,'最后核验日期',true),intro:n('备注')};
  if(!(r.data.stops as string[]).length)issue(r,'地点序列（地点ID）','站点序列为空；保留路线和备注，不从备注范围推测顺序','warning');
  else issue(r,'地点序列（地点ID）','只保留来源候选顺序，sequence_confirmed=false，不承诺路线可通行','warning'); break;
 case '攻略库':
  r.code=required(r,'攻略ID'); if(!/^G-\d{4,}$/.test(r.code))issue(r,'攻略ID','格式须为 G-0001');
  r.data={code:r.code,title:required(r,'标题'),guide_type:enumeration(r,'内容类型',enums.guide_type),place_codes:split(x['关联地点ID']),route_codes:split(x['关联路线ID']),source_workflow:enumeration(r,'发布状态',enums.guide_workflow),publish_status:'草稿',published_at:date(r,'发布时间'),source_updated_at:date(r,'最后修改'),media_note:n('封面/素材备注'),body_source:n('正文文件/链接'),notes:n('备注')};
  issue(r,'发布状态','导入为草稿；来源内容进度另存，不将“已有内容”当成已发布','warning');
  if(!r.data.body_source)issue(r,'正文文件/链接','没有正文文件或链接，保留攻略条目，不生成正文','warning'); break;
 case '实地核验':
  r.code=required(r,'核验ID'); required(r,'核验日期');
  r.data={code:r.code,place_code:required(r,'地点ID'),verified_at:date(r,'核验日期'),verifier:required(r,'核验人'),road_status:n('道路'),parking_status:n('停车'),toilet_status:n('厕所'),open_status:enumeration(r,'开放状态',enums.current_status,true),observation_note:n('水情/自然观察'),weather:n('天气'),source_photo_note:n('现场照片索引'),general_note:n('备注'),created_at:date(r,'录入时间')}; break;
 case '坐标候选匹配': r.code=required(r,'候选ID'); r.data=coordinate(r,false)||{}; break;
 }
}
export function summarize(rows:ImportRow[]) {
 const perSheet:Record<string,{total:number;ready:number;failed:number;skipped:number;warnings:number}>={};
 for(const name of Object.keys(specs))perSheet[name]={total:0,ready:0,failed:0,skipped:0,warnings:0};
 for(const r of rows){const s=perSheet[r.sheet];s.total++;s[r.action==='insert'?'ready':r.action==='skip'?'skipped':'failed']++;s.warnings+=r.issues.filter(i=>i.level==='warning').length;}
 return {total:rows.length,ready:rows.filter(r=>r.action==='insert').length,failed:rows.filter(r=>r.action==='error').length,skipped:rows.filter(r=>r.action==='skip').length,warnings:rows.reduce((n,r)=>n+r.issues.filter(i=>i.level==='warning').length,0),perSheet};
}
export async function snapshot(db:Pool):Promise<Snapshot> {
 const s=emptySnapshot();
 const p=await db.query('SELECT p.code,p.deleted_at,p.duplicate_of_place_id,q.code parent FROM places p LEFT JOIN places q ON q.id=p.parent_place_id');
 for(const r of p.rows)s.places[r.code]=r.parent;
 s.unavailablePlaces=p.rows.filter(r=>r.deleted_at||r.duplicate_of_place_id).map(r=>r.code);
 const terms=await db.query('SELECT dimension,code,name,enabled FROM taxonomy_terms');
 s.terms=terms.rows.map(r=>`${r.dimension}:${r.code}`);s.categories=terms.rows.filter(r=>r.dimension==='一级分类'&&r.enabled).map(r=>r.name);
 for(const [key,table] of [['routes','routes'],['guides','guides'],['verifications','verifications'],['candidates','coordinate_candidates']] as const)s[key]=(await db.query(`SELECT code FROM ${table}`)).rows.map(r=>r.code);
 return s;
}
export function validateRows(rows:ImportRow[],existing:Snapshot) {
 for(const r of rows) {
  const same=rows.filter(v=>v.sheet===r.sheet&&v.code===r.code);
  if(same.length>1)issue(r,'业务编号','同批次重复业务编号，所有冲突行均不导入');
  const keys:Record<string,string[]>={'地点库':Object.keys(existing.places),'分类标签':existing.terms,'路线库':existing.routes,'攻略库':existing.guides,'实地核验':existing.verifications,'坐标候选匹配':existing.candidates};
  if(keys[r.sheet].includes(r.code)){r.action='skip';issue(r,'业务编号','已有业务编号，默认跳过，不覆盖','warning');}
 }
 const exists=(sheet:string,code:string,old:string[])=>old.includes(code)||rows.some(r=>r.sheet===sheet&&r.code===code&&!r.issues.some(i=>i.level==='error'));
 const places=Object.keys(existing.places);
 for(let pass=0;pass<=rows.length;pass++){
  const before=rows.reduce((n,r)=>n+r.issues.length,0);
  for(const r of rows){if(r.action==='skip')continue;const d=r.data;
   const ref=(sheet:string,c:unknown,old:string[],field:string)=>{if(c&&sheet==='地点库'&&existing.unavailablePlaces?.includes(String(c)))issue(r,field,`引用已删除地点或重复档案：${c}`);if(c&&!exists(sheet,String(c),old))issue(r,field,`引用不存在或未通过校验：${c}`);};
   if(r.sheet==='地点库'){
    ref('地点库',d.parent_code,places,'上级地点ID');
    if(!existing.categories.includes(String(d.category))&&!rows.some(v=>v.sheet==='分类标签'&&v.action==='insert'&&v.data.dimension==='一级分类'&&v.data.name===d.category&&v.data.enabled&&!v.issues.some(i=>i.level==='error')))issue(r,'一级分类','分类不存在或未启用');
    const seen=new Set([r.code]);let parent=d.parent_code as string|null;
    while(parent){if(seen.has(parent)){issue(r,'上级地点ID','父子关系形成循环');break;}seen.add(parent);parent=Object.hasOwn(existing.places,parent)?existing.places[parent]:rows.find(v=>v.sheet==='地点库'&&v.code===parent)?.data.parent_code as string|null;}
    for(const c of d.route_codes as string[])ref('路线库',c,existing.routes,'关联路线');
    for(const c of d.guide_codes as string[])ref('攻略库',c,existing.guides,'关联攻略');
   }
   if(r.sheet==='路线库')for(const c of d.stops as string[])ref('地点库',c,places,'地点序列（地点ID）');
   if(r.sheet==='攻略库'){for(const c of d.place_codes as string[])ref('地点库',c,places,'关联地点ID');for(const c of d.route_codes as string[])ref('路线库',c,existing.routes,'关联路线ID');}
   if(r.sheet==='实地核验')ref('地点库',d.place_code,places,'地点ID');
   if(r.sheet==='坐标候选匹配')ref('地点库',d.matched_code,places,'目标地点ID');
  }
  if(rows.reduce((n,r)=>n+r.issues.length,0)===before)break;
 }
 for(const r of rows)if(r.issues.some(i=>i.level==='error'))r.action='error';
}
export async function preview(file:string,existing=emptySnapshot()):Promise<Plan> {
 const workbook=await readWorkbook(file);
 const rows:ImportRow[]=[],sheetIssues:Issue[]=[];
 for(const [sheet,spec] of Object.entries(specs)) {
  const ws=workbook.getWorksheet(sheet);if(!ws){sheetIssues.push({level:'error',field:sheet,message:'缺少工作表'});continue;}
  let header=0;ws.eachRow((row,i)=>{if(!header&&text(row.getCell(1).value)===(sheet==='分类标签'?'维度':spec.key))header=i;});
  if(!header){sheetIssues.push({level:'error',field:sheet,message:'未找到表头'});continue;}
  const headers: string[]=[];ws.getRow(header).eachCell((c,i)=>headers[i]=text(c.value));
  const missing=spec.headers.filter(k=>!headers.includes(k));
  if(missing.length)sheetIssues.push({level:'error',field:sheet,message:`缺少列：${missing.join('、')}`});
  ws.eachRow((row,i)=>{
   if(i<=header)return;const raw:Row={};const errors:string[]=[];const formulas:Row={};
   headers.forEach((h,c)=>{if(!h)return;let v:unknown=row.getCell(c).value;
    if(v&&typeof v==='object'&&!(v instanceof Date)){
     if('formula' in v||'sharedFormula' in v){formulas[h]=v;v=(v as {result?:unknown}).result;if(v===undefined&&!['距今核验天数','信息新鲜度'].includes(h))errors.push(h);}
     else if('richText' in v)v=(v as {richText:{text:string}[]}).richText.map(t=>t.text).join('');
     else if('hyperlink' in v)v=(v as {hyperlink:string}).hyperlink;
     else errors.push(h);
    }
    if(v&&typeof v==='object'&&!(v instanceof Date)&&!errors.includes(h))errors.push(h);
    raw[h]=v??null;
   });
   if(!Object.values(raw).some(v=>v!==null&&v!==''))return;
   if(Object.keys(formulas).length)raw._formulas=formulas;
   const r:ImportRow={sheet,row:i,code:text(raw[spec.key]),raw,data:{},issues:[],action:'insert'};
   for(const h of errors)issue(r,h,'Excel 单元格错误或公式没有缓存结果');
   for(const h of missing)issue(r,h,'缺少表头字段');
   normalize(r);
   if(r.sheet==='地点库'&&r.data.coordinate)(r.data.coordinate as Row).source_file=file.split(/[\\/]/).pop();
   rows.push(r);
  });
 }
 validateRows(rows,existing);
 const sourceSha256=hash(await readFile(file));
 const digest=hash(JSON.stringify({sourceSha256,rows,sheetIssues}));
 return {version:1,source:file,sourceSha256,digest,rows,summary:summarize(rows),sheetIssues};
}

async function insert(c:PoolClient,table:string,data:Row) {
 const entries=Object.entries(data).filter(([,v])=>v!==undefined),cols=entries.map(([k])=>k);
 return (await c.query(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map((_,i)=>`$${i+1}`).join(',')}) RETURNING id`,entries.map(([,v])=>v))).rows[0]?.id as string;
}
const pick=(d:Row,keys:string)=>Object.fromEntries(keys.split(' ').map(k=>[k,d[k]]));
async function id(c:PoolClient,table:string,code:unknown) {if(!code)return null;const q=await c.query(`SELECT id FROM ${table} WHERE code=$1 ${table==='places'?'AND deleted_at IS NULL AND duplicate_of_place_id IS NULL FOR UPDATE':''}`,[code]);if(!q.rowCount)throw Error(`引用未入库：${table}/${code}`);return q.rows[0].id as string;}
async function writeCandidate(c:PoolClient,d:Row,rowId:string) {const {matched_code,...fields}=d;return insert(c,'coordinate_candidates',{...fields,source_type:legacySources[String(d.source_type)]||d.source_type,source_reference:d.source_file||null,accuracy_note:'来源未记录精度',matched_place_id:await id(c,'places',matched_code),source_import_row_id:rowId});}
async function writeRow(c:PoolClient,r:ImportRow,rowId:string,all:ImportRow[]) {
 const d=r.data,source_import_row_id=rowId;
 if(r.sheet==='分类标签')return insert(c,'taxonomy_terms',{...d,source_import_row_id});
 if(r.sheet==='地点库'){
  const category=(await c.query("SELECT id FROM taxonomy_terms WHERE dimension='一级分类' AND name=$1 AND enabled",[d.category])).rows[0];
  if(!category)throw Error(`分类未入库：${d.category}`);
  const p=await insert(c,'places',{...pick(d,'code name place_type tags region public_level current_status priority intro notes risk_note rain_friendly source_last_verified_at'),parent_place_id:await id(c,'places',d.parent_code),category_id:category.id,source_import_row_id});
  await c.query('INSERT INTO place_practical_info(place_id,parking_available,toilet_available) VALUES($1,$2,$3)',[p,d.parking_available,d.toilet_available]);
  await c.query('INSERT INTO place_accessibility(place_id,child_friendly_note,elderly_friendly) VALUES($1,$2,$3)',[p,d.child_friendly_note,d.elderly_friendly]);
  if(d.coordinate)await writeCandidate(c,d.coordinate as Row,rowId);
  // Existing target rows can be linked now; new routes/guides handle the reverse link when inserted.
  for(const code of d.guide_codes as string[]){const target=await c.query('SELECT id FROM guides WHERE code=$1',[code]);if(target.rowCount)await c.query('INSERT INTO guide_places(guide_id,place_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[target.rows[0].id,p]);}
  for(const code of d.route_codes as string[]){const target=await c.query('SELECT id FROM routes WHERE code=$1',[code]);if(target.rowCount)await c.query('INSERT INTO route_place_links(route_id,place_id,source_import_row_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[target.rows[0].id,p,rowId]);}
  return p;
 }
 if(r.sheet==='路线库'){
  const route=await insert(c,'routes',{...pick(d,'code name route_type source_status publish_status suitable_age_note total_duration_min estimated_driving_min estimated_walking_m season_note rain_friendly start_note end_note source_last_verified_at intro'),source_import_row_id});
  for(const [i,code] of (d.stops as string[]).entries())await c.query('INSERT INTO route_stops(route_id,place_id,sequence) VALUES($1,$2,$3)',[route,await id(c,'places',code),i+1]);
  for(const p of all.filter(v=>v.sheet==='地点库'&&v.action==='insert'))if((p.data.route_codes as string[]).includes(r.code))await c.query('INSERT INTO route_place_links(route_id,place_id,source_import_row_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[route,await id(c,'places',p.code),rowId]);
  return route;
 }
 if(r.sheet==='攻略库'){
  const guide=await insert(c,'guides',{...pick(d,'code title guide_type source_workflow publish_status published_at source_updated_at media_note body_source notes'),source_import_row_id});
  const linked=new Set(d.place_codes as string[]);
  for(const p of all.filter(v=>v.sheet==='地点库'&&v.action==='insert'))if((p.data.guide_codes as string[]).includes(r.code))linked.add(p.code);
  for(const code of linked)await c.query('INSERT INTO guide_places(guide_id,place_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[guide,await id(c,'places',code)]);
  for(const code of d.route_codes as string[])await c.query('INSERT INTO guide_routes(guide_id,route_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[guide,await id(c,'routes',code)]);
  return guide;
 }
 if(r.sheet==='实地核验')return insert(c,'verifications',{...pick(d,'code verified_at verifier road_status parking_status toilet_status open_status observation_note weather source_photo_note general_note'),...(d.created_at?{created_at:d.created_at}:{}),place_id:await id(c,'places',d.place_code),source_import_row_id});
 if(r.sheet==='坐标候选匹配')return writeCandidate(c,d,rowId);
}
export async function apply(db:Pool,approved:Plan,file:string) {
 const fresh=await preview(file,await snapshot(db));
 if(fresh.digest!==approved.digest)throw Error('预览已变化（源文件、数据库或映射变化）；请重新预览后导入');
 if(fresh.sheetIssues.length)throw Error('工作表/表头错误，请先修复并重新预览');
 const c=await db.connect();
 const counts={success:0,failed:0,skipped:0,warnings:fresh.summary.warnings,places:0};
 const results:Row[]=[];let jobId:string;
 try {
  jobId=await insert(c,'import_jobs',{source_filename:file.split(/[\\/]/).pop(),source_sha256:fresh.sourceSha256,preview_sha256:fresh.digest,status:'running'});
  const ordered:ImportRow[]=[],pending=[...fresh.rows];
  // Parents before children, even when Excel rows are reordered.
  while(pending.length){const index=pending.findIndex(r=>r.sheet!=='地点库'||!r.data.parent_code||!pending.some(p=>p.sheet==='地点库'&&p.code===r.data.parent_code&&p.action==='insert'));ordered.push(pending.splice(index<0?0:index,1)[0]);}
  for(const r of ordered){
   const rowId=await insert(c,'import_rows',{job_id:jobId,sheet:r.sheet,row_number:r.row,business_code:r.code,payload:JSON.stringify(r.raw),outcome:'pending',issues:JSON.stringify(r.issues)});
   let outcome='skipped';const issues=[...r.issues];
   if(r.action==='error'){outcome='failed';counts.failed++;}
   else if(r.action==='skip')counts.skipped++;
   else {
    await c.query('BEGIN');
    try {await c.query('SELECT pg_advisory_xact_lock(91724001)');await writeRow(c,r,rowId,fresh.rows);await c.query('COMMIT');outcome='success';counts.success++;if(r.sheet==='地点库')counts.places++;}
    catch(e){await c.query('ROLLBACK');const err=e as Error & {code?:string};if(err.code==='23505'){outcome='skipped';counts.skipped++;counts.warnings++;issues.push({level:'warning',field:'业务编号',message:'并发冲突或唯一键已存在，跳过，不覆盖'});}else{outcome='failed';counts.failed++;issues.push({level:'error',field:'数据库',message:err.message});}}
   }
   await c.query('UPDATE import_rows SET outcome=$1,issues=$2 WHERE id=$3',[outcome,JSON.stringify(issues),rowId]);
   results.push({sheet:r.sheet,row:r.row,code:r.code,outcome,issues});
  }
  const result={jobId,sourceSha256:fresh.sourceSha256,counts,rows:results};
  await c.query("UPDATE import_jobs SET status='completed',completed_at=now(),result=$1 WHERE id=$2",[JSON.stringify(result),jobId]);
  return result;
 } finally {c.release();}
}
