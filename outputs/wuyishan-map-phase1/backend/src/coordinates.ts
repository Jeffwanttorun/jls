import type {Pool,PoolClient} from 'pg';
import {randomUUID} from 'node:crypto';
import gcoordPackage from 'gcoord';
// gcoord 1.0.7 ships a CommonJS default with an ES-module declaration; keep the interop local.
const gcoord=gcoordPackage as unknown as {WGS84:string;BD09:string;GCJ02:string;transform:(xy:[number,number],from:string,to:string)=>[number,number]};
import type {CandidateInput} from '../../shared/coordinates.js';
export class CoordinateError extends Error {constructor(public statusCode:number,message:string){super(message);}}
export function convertForMap(latitude:number,longitude:number,system:string){
 if(system==='未知')return {converted_latitude:null,converted_longitude:null,map_coordinate_system:null,conversion_method:null};
 const source=system==='WGS84'?gcoord.WGS84:system==='BD-09'?gcoord.BD09:gcoord.GCJ02;
 const [lng,lat]=gcoord.transform([longitude,latitude],source,gcoord.GCJ02);
 return {converted_latitude:lat,converted_longitude:lng,map_coordinate_system:'GCJ-02',conversion_method:system==='GCJ-02'?'identity:GCJ-02':`gcoord@1.0.7:${system}->GCJ-02;internal-display`};
}
async function inTransaction<T>(db:Pool,fn:(c:PoolClient)=>Promise<T>){const c=await db.connect();try{await c.query('BEGIN');const result=await fn(c);await c.query('COMMIT');return result;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
export async function addCandidate(db:Pool,code:string,input:CandidateInput){
 return inTransaction(db,async c=>{
 const place=(await c.query('SELECT id,duplicate_of_place_id FROM places WHERE code=$1 AND deleted_at IS NULL FOR UPDATE',[code])).rows[0];
 if(!place)throw new CoordinateError(404,'地点不存在');
 if(place.duplicate_of_place_id)throw new CoordinateError(409,'该编号为保留的重复档案，请在合并后的地点采集候选');
 if(!Number.isFinite(Date.parse(input.source_time))||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(Z|[+-]\d\d:\d\d)$/.test(input.source_time))throw new CoordinateError(400,'采集时间须为带时区的 ISO 8601 时间');
 if(input.source_type==='phone_gps'&&(input.coordinate_system!=='WGS84'||input.accuracy_meters===null))throw new CoordinateError(400,'手机浏览器定位必须保留 WGS84 原值及精度');
 if(input.source_type==='map_click'&&input.coordinate_system!=='GCJ-02')throw new CoordinateError(400,'腾讯地图点选必须使用 GCJ-02');
 const converted=convertForMap(input.latitude,input.longitude,input.coordinate_system);
 const data={code:`C-${randomUUID()}`,matched_place_id:place.id,raw_latitude:input.latitude,raw_longitude:input.longitude,
 raw_coordinate_system:input.coordinate_system,accuracy_meters:input.accuracy_meters,accuracy_note:input.accuracy_meters===null?'未测量；不能据此宣称定位精度':null,
 position_certainty:input.position_certainty||null,confidence_level:input.source_type==='map_click'?'C':null,
 source_type:input.source_type,source_reference:input.source_reference||null,source_time:input.source_time,source_time_original:input.source_time,notes:input.notes||null,...converted};
 const keys=Object.keys(data);
 return (await c.query(`INSERT INTO coordinate_candidates(${keys.join(',')}) VALUES(${keys.map((_,i)=>'$'+(i+1)).join(',')}) RETURNING *`,Object.values(data))).rows[0];
 });
}
export async function confirmCandidate(db:Pool,code:string,candidateId:string,expectedCurrentId:string|null){
 return inTransaction(db,async c=>{
  const p=(await c.query('SELECT id FROM places WHERE code=$1 AND deleted_at IS NULL AND duplicate_of_place_id IS NULL FOR UPDATE',[code])).rows[0];if(!p)throw new CoordinateError(404,'地点不存在或为重复档案');
  const candidate=(await c.query('SELECT * FROM coordinate_candidates WHERE id=$1 AND matched_place_id=$2 FOR UPDATE',[candidateId,p.id])).rows[0];
  if(!candidate)throw new CoordinateError(404,'候选不存在或不属于此地点');
  if(candidate.status==='confirmed'){
   const formal=(await c.query('SELECT * FROM place_coordinates WHERE candidate_id=$1',[candidateId])).rows[0];
   if(formal?.status!=='active')throw new CoordinateError(409,'此候选对应的正式坐标已替换或撤销，请刷新后核对');
   return formal;
  }
  if(candidate.status!=='pending')throw new CoordinateError(409,'候选已被拒绝，不能确认');
  const current=(await c.query("SELECT id FROM place_coordinates WHERE place_id=$1 AND status='active'",[p.id])).rows[0]?.id||null;
  if(current!==expectedCurrentId)throw new CoordinateError(409,'当前正式坐标已变化，请刷新后重新核对');
  if(candidate.raw_coordinate_system==='未知'||candidate.converted_latitude===null||candidate.map_coordinate_system!=='GCJ-02')throw new CoordinateError(422,'候选坐标系未知或无有效地图转换结果，请新建明确坐标系的候选');
  await c.query("UPDATE coordinate_candidates SET status='confirmed',human_confirmed=true,confirmed_at=now(),confirmed_by='owner',reviewed_at=now(),reviewed_by='owner',writeback_status='已写回' WHERE id=$1",[candidateId]);
  return (await c.query(`INSERT INTO place_coordinates(place_id,candidate_id,raw_latitude,raw_longitude,raw_coordinate_system,source_type,source_reference,source_file,source_time,accuracy_meters,accuracy_note,confidence_level,position_certainty,map_latitude,map_longitude,map_coordinate_system,conversion_method,human_confirmed,confirmed_at,confirmed_by)
   SELECT matched_place_id,id,raw_latitude,raw_longitude,raw_coordinate_system,source_type,source_reference,source_file,source_time,accuracy_meters,accuracy_note,confidence_level,position_certainty,converted_latitude,converted_longitude,map_coordinate_system,conversion_method,true,confirmed_at,confirmed_by FROM coordinate_candidates WHERE id=$1 RETURNING *`,[candidateId])).rows[0];
 });
}
export async function rejectCandidate(db:Pool,code:string,candidateId:string,reason:string){
 return inTransaction(db,async c=>{
  const p=(await c.query('SELECT id FROM places WHERE code=$1 AND deleted_at IS NULL FOR UPDATE',[code])).rows[0];
  if(!p)throw new CoordinateError(404,'地点不存在');
  const r=(await c.query('SELECT cc.* FROM coordinate_candidates cc JOIN places p ON p.id=cc.matched_place_id WHERE cc.id=$1 AND p.code=$2 AND p.deleted_at IS NULL FOR UPDATE OF cc',[candidateId,code])).rows[0];
  if(!r)throw new CoordinateError(404,'候选不存在或不属于此地点');
  if(r.status==='rejected')return r;
  if(r.status!=='pending')throw new CoordinateError(409,'已确认候选不能拒绝，请撤销其正式坐标');
  return (await c.query("UPDATE coordinate_candidates SET status='rejected',rejected_reason=$2,reviewed_at=now(),reviewed_by='owner',writeback_status='已拒绝' WHERE id=$1 RETURNING *",[candidateId,reason.trim()])).rows[0];
 });
}
export async function revokeCoordinate(db:Pool,code:string,id:string,reason:string,expectedCurrentId?:string){
 return inTransaction(db,async c=>{
  const p=(await c.query('SELECT id FROM places WHERE code=$1 AND deleted_at IS NULL FOR UPDATE',[code])).rows[0];if(!p)throw new CoordinateError(404,'地点不存在');
  if(expectedCurrentId!==undefined){const current=(await c.query("SELECT id FROM place_coordinates WHERE place_id=$1 AND status='active'",[p.id])).rows[0];if(current?.id!==expectedCurrentId||id!==expectedCurrentId)throw new CoordinateError(409,'当前定位已变化，请取消后刷新并重新核对；未删除任何定位');}
  const row=(await c.query('SELECT * FROM place_coordinates WHERE id=$1 AND place_id=$2 FOR UPDATE',[id,p.id])).rows[0];
  if(!row)throw new CoordinateError(404,'正式坐标不存在');if(row.status==='revoked')return row;
  if(row.status!=='active')throw new CoordinateError(409,'只能撤销当前有效坐标');
  return (await c.query("UPDATE place_coordinates SET status='revoked',revoked_at=now(),revoked_by='owner',revocation_reason=$2 WHERE id=$1 RETURNING *",[id,reason.trim()])).rows[0];
 });
}
