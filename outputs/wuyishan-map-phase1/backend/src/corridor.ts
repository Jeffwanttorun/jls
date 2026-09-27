import type {Pool} from 'pg';
import type {FastifyInstance} from 'fastify';
import {CoordinateError} from './coordinates.js';
export const corridorSort='corridor_order ASC NULLS LAST,code';
export function registerCorridorRoutes(app:FastifyInstance,db:Pool){
 app.post('/api/admin/places/:code/corridor-move',{schema:{params:{type:'object',required:['code'],properties:{code:{type:'string',pattern:'^WY-[0-9]{4,}$'}}},body:{type:'object',additionalProperties:false,required:['direction','expected_order'],properties:{direction:{type:'string',enum:['up','down']},expected_order:{type:'integer',minimum:1,maximum:2147483647}}}}},async req=>{
  const {direction,expected_order}=req.body as {direction:'up'|'down';expected_order:number};
  const c=await db.connect();try{
   await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(91724001)');
   const p=(await c.query('SELECT id,corridor_order FROM places WHERE code=$1 AND duplicate_of_place_id IS NULL AND deleted_at IS NULL FOR UPDATE',[(req.params as {code:string}).code])).rows[0];
   if(!p)throw new CoordinateError(404,'地点不存在或为重复档案');
   if(p.corridor_order!==expected_order)throw new CoordinateError(409,'路线顺序已变化，请刷新后重试');
   const neighbor=(await c.query(`SELECT id,code,corridor_order FROM places WHERE duplicate_of_place_id IS NULL AND deleted_at IS NULL AND corridor_order ${direction==='up'?'<':'>'} $1 ORDER BY corridor_order ${direction==='up'?'DESC':'ASC'} LIMIT 1 FOR UPDATE`,[p.corridor_order])).rows[0];
   if(!neighbor)throw new CoordinateError(409,direction==='up'?'已经是首个已排地点':'已经是最后一个已排地点；待排地点不会被自动插入');
   await c.query('SET CONSTRAINTS corridor_order_unique DEFERRED');
   await c.query('UPDATE places SET corridor_order=CASE WHEN id=$1 THEN $3::integer ELSE $4::integer END WHERE id IN ($1,$2)',[p.id,neighbor.id,neighbor.corridor_order,p.corridor_order]);
   await c.query('COMMIT');return {corridor_order:neighbor.corridor_order,swapped_with:neighbor.code};
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 });
 app.post('/api/admin/places/:code/corridor-order',{schema:{params:{type:'object',required:['code'],properties:{code:{type:'string',pattern:'^WY-[0-9]{4,}$'}}},body:{type:'object',additionalProperties:false,required:['order','expected_order'],properties:{order:{type:['integer','null'],minimum:1,maximum:2147483647},expected_order:{type:['integer','null'],minimum:1,maximum:2147483647}}}}},async req=>{
  const {order,expected_order}=req.body as {order:number|null;expected_order:number|null};
  const c=await db.connect();
  try{
   await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(91724001)');
   const p=(await c.query('SELECT id,corridor_order,duplicate_of_place_id FROM places WHERE code=$1 AND deleted_at IS NULL FOR UPDATE',[(req.params as {code:string}).code])).rows[0];
   if(!p)throw new CoordinateError(404,'地点不存在');
   if(p.duplicate_of_place_id)throw new CoordinateError(409,'重复档案不参与路线排序');
   if(p.corridor_order!==expected_order)throw new CoordinateError(409,'路线顺序已被其他页面修改，请刷新后重试');
   if(order!==null&&(await c.query('SELECT 1 FROM places WHERE corridor_order=$1 AND id<>$2',[order,p.id])).rowCount)throw new CoordinateError(409,'顺序号已占用，请选择空号；未修改任何地点');
   await c.query('UPDATE places SET corridor_order=$1 WHERE id=$2',[order,p.id]);await c.query('COMMIT');return {corridor_order:order};
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 });
}
