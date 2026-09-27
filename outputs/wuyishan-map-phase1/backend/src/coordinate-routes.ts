import type {FastifyInstance} from 'fastify';
import type {Pool} from 'pg';
import {coordinateSources,positionCertainties,type CandidateInput} from '../../shared/coordinates.js';
import {addCandidate,confirmCandidate,rejectCandidate,revokeCoordinate} from './coordinates.js';
const code={type:'string',pattern:'^WY-[0-9]{4,}$'};
const uuid={type:'string',format:'uuid'};
const reason={type:'object',additionalProperties:false,required:['reason'],properties:{reason:{type:'string',minLength:1,maxLength:1000,pattern:'\\S'}}};
export function registerCoordinateRoutes(app:FastifyInstance,db:Pool){
 app.post('/api/admin/places/:code/location/delete',{schema:{params:{type:'object',required:['code'],properties:{code}},body:{type:'object',additionalProperties:false,required:['expected_current_id'],properties:{expected_current_id:uuid}}}},async req=>{const current=(req.body as {expected_current_id:string}).expected_current_id;return revokeCoordinate(db,(req.params as {code:string}).code,current,'用户手动删除当前定位；地点和坐标历史保留',current);});
 app.get('/api/admin/map-config',async()=>({key:process.env.TENCENT_MAP_KEY||'',provider:'tencent',coordinate_system:'GCJ-02',child_zoom:14}));
 app.post('/api/admin/places/:code/coordinate-candidates',{schema:{params:{type:'object',required:['code'],properties:{code}},body:{type:'object',additionalProperties:false,
  required:['latitude','longitude','coordinate_system','accuracy_meters','source_type','source_time'],properties:{latitude:{type:'number',minimum:-90,maximum:90},longitude:{type:'number',minimum:-180,maximum:180},coordinate_system:{type:'string',enum:['WGS84','GCJ-02','BD-09','未知']},accuracy_meters:{type:['number','null'],minimum:0,maximum:10000000},source_type:{type:'string',enum:coordinateSources},source_reference:{type:'string',maxLength:1000},source_time:{type:'string',format:'date-time'},notes:{type:'string',maxLength:2000},position_certainty:{type:'string',enum:positionCertainties}}}}},async(req,reply)=>{
   return reply.code(201).send(await addCandidate(db,(req.params as {code:string}).code,req.body as CandidateInput));
 });
 const params={type:'object',required:['code','id'],properties:{code,id:uuid}};
 app.post('/api/admin/places/:code/coordinate-candidates/:id/confirm',{schema:{params,body:{type:'object',additionalProperties:false,required:['expected_current_id','acknowledged'],properties:{expected_current_id:{anyOf:[uuid,{type:'null'}]},acknowledged:{const:true}}}}},async req=>{
  const p=req.params as {code:string;id:string};return confirmCandidate(db,p.code,p.id,(req.body as {expected_current_id:string|null}).expected_current_id);
 });
 app.post('/api/admin/places/:code/coordinate-candidates/:id/reject',{schema:{params,body:reason}},async req=>{const p=req.params as {code:string;id:string};return rejectCandidate(db,p.code,p.id,(req.body as {reason:string}).reason);});
 app.post('/api/admin/places/:code/coordinates/:id/revoke',{schema:{params,body:{...reason,properties:{...reason.properties,expected_current_id:uuid}}}},async req=>{const p=req.params as {code:string;id:string},body=req.body as {reason:string;expected_current_id?:string};return revokeCoordinate(db,p.code,p.id,body.reason,body.expected_current_id);});
 app.get('/api/admin/map-places',{schema:{querystring:{type:'object',additionalProperties:false,properties:{category:{type:'string',maxLength:100},region:{type:'string',maxLength:100},status:{type:'string',enum:['正常','临时关闭','季节关闭','在建','施工','道路中断','不建议前往','永久关闭','待核实']},public_level:{type:'string',enum:['P1','P2','P3','P4','P5']},coordinate_status:{type:'string',enum:['active','active_with_pending','pending','superseded','revoked']}}}}},async req=>{
  const q=req.query as Record<string,string>;if(q.coordinate_status&&['pending','superseded','revoked'].includes(q.coordinate_status))return {items:[]};
  const values:string[]=[],where:string[]=["p.map_display_role<>'hidden'",'p.duplicate_of_place_id IS NULL','p.deleted_at IS NULL'];
  for(const [key,column] of [['category','t.name'],['region','p.region'],['status','p.current_status'],['public_level','p.public_level']])if(q[key]){values.push(q[key]);where.push(`${column}=$${values.length}`);}
  if(q.coordinate_status==='active_with_pending')where.push("EXISTS(SELECT 1 FROM coordinate_candidates cc WHERE cc.matched_place_id=p.id AND cc.status='pending')");
  return {items:(await db.query(`SELECT p.code,p.name,p.updated_at,p.map_display_role,p.corridor_order,p.corridor_role,parent.code parent_code,p.region,t.name category_name,p.current_status,p.public_level,
   c.id coordinate_id,c.status coordinate_status,c.map_latitude latitude,c.map_longitude longitude,c.map_coordinate_system coordinate_system,
   EXISTS(SELECT 1 FROM coordinate_candidates cc WHERE cc.matched_place_id=p.id AND cc.status='pending') has_pending,
   ARRAY(WITH RECURSIVE ancestors AS (SELECT id,code,parent_place_id FROM places WHERE id=p.parent_place_id UNION ALL SELECT a.id,a.code,a.parent_place_id FROM places a JOIN ancestors b ON a.id=b.parent_place_id) SELECT code FROM ancestors) ancestor_codes
   FROM places p JOIN confirmed_place_coordinates c ON c.place_id=p.id JOIN taxonomy_terms t ON t.id=p.category_id LEFT JOIN places parent ON parent.id=p.parent_place_id ${where.length?'WHERE '+where.join(' AND '):''} ORDER BY p.corridor_order ASC NULLS LAST,p.code`,values)).rows};
 });
}
