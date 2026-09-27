import Fastify from 'fastify';
import {registerPlaceMaintenance} from './place-maintenance.js';
import {corridorSort,registerCorridorRoutes} from './corridor.js';
import type { Pool } from 'pg';
import { enums, freshness } from '../../shared/domain.js';
import { registerCoordinateRoutes } from './coordinate-routes.js';
import { CoordinateError } from './coordinates.js';
import {VisitorContentError} from '../../shared/visitor-content.js';
import {registerVisitorContentRoutes} from './visitor-content-routes.js';
import {registerSitePublishing} from './site-publishing.js';
import {timingSafeEqual} from 'node:crypto';
const summarySql=`SELECT p.*,t.name category_name,parent.code parent_code,parent.name parent_name,
 v.last_verified_at,CASE WHEN c.id IS NOT NULL THEN '已确认' WHEN EXISTS(SELECT 1 FROM coordinate_candidates cc WHERE cc.matched_place_id=p.id AND cc.status='pending') THEN '待确认' ELSE '缺坐标' END coordinate_status
 FROM places p JOIN taxonomy_terms t ON t.id=p.category_id LEFT JOIN places parent ON parent.id=p.parent_place_id
 LEFT JOIN LATERAL(SELECT max(verified_at) last_verified_at FROM verifications WHERE place_id=p.id) v ON true
 LEFT JOIN confirmed_place_coordinates c ON c.place_id=p.id`;
export function createApp(db:Pool) {
 const app=Fastify({logger:false,ajv:{customOptions:{removeAdditional:false}}});
 app.addHook('onRequest',async(req,reply)=>{
  reply.header('Cache-Control','no-store');reply.header('X-Content-Type-Options','nosniff');
  const password=process.env.ADMIN_PASSWORD;
  if(password&&req.url.startsWith('/api/admin/')){
   const header=String(req.headers.authorization||''),encoded=header.startsWith('Basic ')?header.slice(6):'';let supplied='';
   try{supplied=Buffer.from(encoded,'base64').toString('utf8').split(':').slice(1).join(':');}catch{/* invalid credentials */}
   const expected=Buffer.from(password),actual=Buffer.from(supplied);
   if(expected.length!==actual.length||!timingSafeEqual(expected,actual)){reply.header('WWW-Authenticate','Basic realm="Local Dad Admin"');return reply.code(401).send({error:'需要登录维护后台'});}
  }
 });
 app.setErrorHandler((err,req,reply)=>{const error=err as Error & {validation?:unknown};if(error.validation)return reply.code(400).send({error:'请求参数格式错误'});if(error instanceof CoordinateError||error instanceof VisitorContentError)return reply.code(error.statusCode).send({error:error.message});req.log.error(error);return reply.code(500).send({error:'请求失败，请检查服务端日志'});});
 registerCoordinateRoutes(app,db);
 registerPlaceMaintenance(app,db);
 registerCorridorRoutes(app,db);
 registerVisitorContentRoutes(app,db);
 registerSitePublishing(app);
 app.get('/health',async()=>{await db.query('SELECT 1');return {status:'ok'};});
 app.get('/api/admin/coordinate-queue',{schema:{querystring:{type:'object',additionalProperties:false,properties:{after:{type:'string',pattern:'^WY-[0-9]{4,}$'}}}}},async req=>{
  const after=(req.query as {after?:string}).after||'';
  const rows=(await db.query(`SELECT p.code,p.name,p.corridor_order,
   EXISTS(SELECT 1 FROM coordinate_candidates cc WHERE cc.matched_place_id=p.id AND cc.status='pending') has_pending
   FROM places p WHERE p.duplicate_of_place_id IS NULL AND p.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM confirmed_place_coordinates c WHERE c.place_id=p.id)
   ORDER BY ${corridorSort}`)).rows;
  const current=(await db.query('SELECT corridor_order FROM places WHERE code=$1 AND deleted_at IS NULL',[after])).rows[0];
  const eligible=rows.filter(p=>p.code!==after);
  const next=eligible.find(p=>current?.corridor_order!=null && p.corridor_order!=null && p.corridor_order>current.corridor_order)
    ||(current?eligible.find(p=>p.corridor_order===null&&(current.corridor_order!==null||p.code>after)):null)||eligible[0]||null;
  return {remaining:rows.length,unranked:rows.filter(p=>p.corridor_order===null).length,next};
 });
 app.get('/api/admin/options',async()=>{
  const regions=(await db.query('SELECT DISTINCT region FROM places WHERE region IS NOT NULL AND deleted_at IS NULL ORDER BY region')).rows.map(r=>r.region);
  const categories=(await db.query("SELECT name FROM taxonomy_terms WHERE dimension='一级分类' AND enabled ORDER BY name")).rows.map(r=>r.name);
  const tags=(await db.query('SELECT DISTINCT unnest(tags) tag FROM places WHERE deleted_at IS NULL ORDER BY tag')).rows.map(r=>r.tag);
  return {regions,categories,tags,...enums};
 });
 const querySchema={type:'object',additionalProperties:false,properties:{q:{type:'string',maxLength:120},region:{type:'string',maxLength:100},category:{type:'string',maxLength:100},tag:{type:'string',maxLength:100},priority:{type:'string',enum:enums.priority},status:{type:'string',enum:enums.current_status},public_level:{type:'string',enum:enums.public_level},archive:{type:'string',enum:['active','duplicates','all']},coordinate:{type:'string',enum:['缺坐标','待确认','已确认','无正式坐标']},freshness:{type:'string',enum:['待核验','新鲜','建议复核','已过期']},sort:{type:'string',enum:['corridor','updated','oldest','priority','coordinates']},page:{type:'integer',minimum:1,maximum:100000,default:1},page_size:{type:'integer',minimum:1,maximum:100,default:25}}};
 app.get('/api/admin/places',{schema:{querystring:querySchema}},async req=>{
  const q=req.query as Record<string,string>;const values:unknown[]=[],conditions:string[]=['deleted_at IS NULL'];
  const add=(sql:string,v:unknown)=>{values.push(v);conditions.push(sql.replace('?',`$${values.length}`));};
  if(q.q){values.push(`%${q.q.replace(/[\\%_]/g,'\\$&')}%`);const index='$'+values.length;conditions.push(`(name ILIKE ${index} OR code ILIKE ${index} OR EXISTS(SELECT 1 FROM place_name_history h WHERE h.place_id=listed.id AND (h.old_name ILIKE ${index} OR h.new_name ILIKE ${index})))`);}
  for(const [key,column] of [['region','region'],['category','category_name'],['priority','priority'],['status','current_status'],['public_level','public_level'],['coordinate','coordinate_status']])if(q[key]){if(key==='coordinate'&&q[key]==='无正式坐标')conditions.push("coordinate_status <> '已确认'");else add(`${column} = ?`,q[key]);}
  if(q.archive==='duplicates')conditions.push('duplicate_of_place_id IS NOT NULL');
  else if(q.archive!=='all')conditions.push('duplicate_of_place_id IS NULL');
  if(q.tag)add('? = ANY(tags)',q.tag);
  const freshSql:Record<string,string>={'待核验':'last_verified_at IS NULL','新鲜':"last_verified_at >= now() - interval '91 days'",'建议复核':"last_verified_at < now() - interval '91 days' AND last_verified_at >= now() - interval '181 days'",'已过期':"last_verified_at < now() - interval '181 days'"};
  if(q.freshness)conditions.push(`(${freshSql[q.freshness]})`);
  const where=conditions.length?`WHERE ${conditions.join(' AND ')}`:'';
  const from=`FROM (${summarySql}) listed ${where}`;
  const total=Number((await db.query(`SELECT count(*) n ${from}`,values)).rows[0].n);
  const sorts:Record<string,string>={corridor:corridorSort,updated:'updated_at DESC,code',oldest:'last_verified_at ASC NULLS FIRST,code',priority:"CASE priority WHEN '高' THEN 1 WHEN '中' THEN 2 ELSE 3 END,code",coordinates:"CASE coordinate_status WHEN '缺坐标' THEN 1 WHEN '待确认' THEN 2 ELSE 3 END,code"};
  values.push(Number(q.page_size), (Number(q.page)-1)*Number(q.page_size));
  const rows=(await db.query(`SELECT id,code,name,corridor_order,corridor_role,map_display_role,duplicate_of_place_id,place_type,region,category_name,tags,priority,current_status,public_level,coordinate_status,last_verified_at,source_last_verified_at,updated_at ${from} ORDER BY ${sorts[q.sort||'corridor']} LIMIT $${values.length-1} OFFSET $${values.length}`,values)).rows;
  return {items:rows.map(p=>({...p,freshness:freshness(p.last_verified_at)})),total,page:Number(q.page),page_size:Number(q.page_size)};
 });
 const params={type:'object',required:['code'],properties:{code:{type:'string',pattern:'^WY-[0-9]{4,}$'}}};
 app.get('/api/admin/places/:code',{schema:{params}},async(req,reply)=>{
  const p=(await db.query(`${summarySql} WHERE p.code=$1 AND p.deleted_at IS NULL`,[(req.params as {code:string}).code])).rows[0];
  if(!p)return reply.code(404).send({error:'地点不存在'});
  const fetch=async(sql:string)=>(await db.query(sql,[p.id])).rows;
  const [children,coordinates,candidates,practical,accessibility,nature,water,verifications,routes,guides,media]=await Promise.all([
   fetch('SELECT code,name,public_level FROM places WHERE parent_place_id=$1 AND duplicate_of_place_id IS NULL AND deleted_at IS NULL ORDER BY corridor_order ASC NULLS LAST,code'),
   fetch('SELECT * FROM place_coordinates WHERE place_id=$1 ORDER BY created_at DESC,id DESC'),
   fetch('SELECT * FROM coordinate_candidates WHERE matched_place_id=$1 ORDER BY created_at DESC,id DESC'),
   fetch('SELECT * FROM place_practical_info WHERE place_id=$1'),fetch('SELECT * FROM place_accessibility WHERE place_id=$1'),fetch('SELECT * FROM place_nature WHERE place_id=$1'),fetch('SELECT * FROM place_water WHERE place_id=$1'),
   fetch('SELECT * FROM verifications WHERE place_id=$1 ORDER BY verified_at DESC,id DESC'),
   fetch('SELECT r.code,r.name,r.publish_status,r.sequence_confirmed,s.sequence FROM routes r LEFT JOIN route_stops s ON s.route_id=r.id AND s.place_id=$1 WHERE s.place_id=$1 OR EXISTS(SELECT 1 FROM route_place_links l WHERE l.route_id=r.id AND l.place_id=$1) ORDER BY r.code,s.sequence'),
   fetch(`SELECT DISTINCT g.code,g.title,g.publish_status FROM guides g LEFT JOIN guide_places gp ON gp.guide_id=g.id LEFT JOIN guide_routes gr ON gr.guide_id=g.id LEFT JOIN route_stops rs ON rs.route_id=gr.route_id WHERE gp.place_id=$1 OR rs.place_id=$1 OR gp.place_id IN (SELECT id FROM places WHERE duplicate_of_place_id=$1) ORDER BY g.code`),fetch('SELECT * FROM media WHERE place_id=$1')
  ]);
  const name_history=await fetch('SELECT old_name,new_name,changed_at,change_source FROM place_name_history WHERE place_id=$1 ORDER BY changed_at DESC,id DESC');
  const duplicate=p.duplicate_of_place_id?(await db.query('SELECT code,name FROM places WHERE id=$1',[p.duplicate_of_place_id])).rows[0]:null;
  return {...p,duplicate,name_history,freshness:freshness(p.last_verified_at),children,coordinates,candidates,practical:practical[0]||null,accessibility:accessibility[0]||null,nature:nature[0]||null,water:water[0]||null,latest_verification:verifications[0]||null,verifications,routes,guides,media};
 });
 // Formal position contracts only. This is not a visitor application.
 app.get('/api/places',async()=>({items:(await db.query('SELECT * FROM public_places ORDER BY code')).rows}));
 app.get('/api/places/:code',{schema:{params}},async(req,reply)=>{
  const p=(await db.query('SELECT * FROM public_places WHERE code=$1',[(req.params as {code:string}).code])).rows[0];
  return p||reply.code(404).send({error:'地点不存在'});
 });
 return app;
}
