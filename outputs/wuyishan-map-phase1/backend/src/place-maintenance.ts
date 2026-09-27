import type {Pool} from 'pg';import type {FastifyInstance} from 'fastify';import {CoordinateError} from './coordinates.js';
import {createHash} from 'node:crypto';
const childToken=(rows:any[])=>createHash('sha256').update(JSON.stringify(rows.map(r=>[r.id,r.code,r.name,r.updated_at]).sort((a,b)=>a[1].localeCompare(b[1])))).digest('hex');
function normalizedName(value:string){const name=value.trim();if(!name||[...name].length>120||/[\u0000-\u001f\u007f]/.test(name))throw new CoordinateError(400,'名称须为1至120个字符，不能是空白或包含控制字符');return name;}
export function registerPlaceMaintenance(app:FastifyInstance,db:Pool){
 const params={type:'object',required:['code'],properties:{code:{type:'string',pattern:'^WY-[0-9]{4,}$'}}};
 app.get('/api/admin/places/:code/name-conflicts',{schema:{params,querystring:{type:'object',additionalProperties:false,required:['name'],properties:{name:{type:'string',minLength:1,maxLength:120}}}}},async req=>{
  const name=normalizedName((req.query as {name:string}).name),code=(req.params as {code:string}).code;
  const p=(await db.query('SELECT id,region FROM places WHERE code=$1 AND deleted_at IS NULL',[code])).rows[0];if(!p)throw new CoordinateError(404,'地点不存在');
  return {items:(await db.query('SELECT code,name FROM places WHERE id<>$1 AND region IS NOT DISTINCT FROM $2 AND lower(trim(name))=lower($3) AND duplicate_of_place_id IS NULL AND deleted_at IS NULL ORDER BY code',[p.id,p.region,name])).rows};
 });
 app.post('/api/admin/places/:code/name',{schema:{params,body:{type:'object',additionalProperties:false,required:['name','expected_name'],properties:{name:{type:'string',minLength:1,maxLength:120},expected_name:{type:'string',minLength:1,maxLength:120}}}}},async req=>{
  const input=req.body as {name:string;expected_name:string},name=normalizedName(input.name),c=await db.connect();
  try{
   await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(91724001)');
   const p=(await c.query('SELECT id,code,name,region FROM places WHERE code=$1 AND deleted_at IS NULL FOR UPDATE',[(req.params as {code:string}).code])).rows[0];if(!p)throw new CoordinateError(404,'地点不存在');
   if(p.name!==input.expected_name)throw new CoordinateError(409,'名称已被另一页面修改，请取消并刷新后再编辑');
   const warnings=(await c.query('SELECT code,name FROM places WHERE id<>$1 AND region IS NOT DISTINCT FROM $2 AND lower(trim(name))=lower($3) AND duplicate_of_place_id IS NULL AND deleted_at IS NULL ORDER BY code',[p.id,p.region,name])).rows;
   if(p.name!==name){await c.query("SELECT set_config('app.name_change_source','admin_ui',true)");await c.query('UPDATE places SET name=$1 WHERE id=$2',[name,p.id]);}
   await c.query('COMMIT');return {code:p.code,name,changed:p.name!==name,warnings};
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 });
 app.get('/api/admin/recycle-bin',{schema:{querystring:{type:'object',additionalProperties:false,properties:{q:{type:'string',maxLength:120},page:{type:'integer',minimum:1,maximum:100000,default:1},page_size:{type:'integer',minimum:1,maximum:100,default:25}}}}},async req=>{
  const q=req.query as {q?:string;page:number;page_size:number},values:unknown[]=[];let search='';
  if(q.q){values.push(`%${q.q.replace(/[\\%_]/g,'\\$&')}%`);search=`AND (p.code ILIKE $1 OR p.name ILIKE $1 OR EXISTS(SELECT 1 FROM place_name_history h WHERE h.place_id=p.id AND (h.old_name ILIKE $1 OR h.new_name ILIKE $1)))`;}
  const total=Number((await db.query(`SELECT count(*) n FROM places p WHERE p.deleted_at IS NOT NULL ${search}`,values)).rows[0].n);
  values.push(q.page_size,(q.page-1)*q.page_size);
  const items=(await db.query(`SELECT p.id,p.code,p.name,p.region,p.parent_place_id,parent.code parent_code,parent.name parent_name,p.deleted_at,p.deleted_by,p.deletion_reason,p.updated_at,
   (SELECT count(*)::int FROM place_coordinates c WHERE c.place_id=p.id) coordinate_history_count,
   (SELECT count(*)::int FROM place_name_history h WHERE h.place_id=p.id) name_history_count
   FROM places p LEFT JOIN places parent ON parent.id=p.parent_place_id WHERE p.deleted_at IS NOT NULL ${search}
   ORDER BY p.deleted_at DESC,p.code LIMIT $${values.length-1} OFFSET $${values.length}`,values)).rows;
  return {items,total,page:q.page,page_size:q.page_size};
 });
 app.get('/api/admin/places/:code/delete-preview',{schema:{params}},async req=>{
  const code=(req.params as {code:string}).code,p=(await db.query('SELECT id FROM places WHERE code=$1 AND deleted_at IS NULL',[code])).rows[0];if(!p)throw new CoordinateError(404,'地点不存在');
  const children=(await db.query('SELECT id,code,name,region,updated_at FROM places WHERE parent_place_id=$1 AND deleted_at IS NULL ORDER BY corridor_order ASC NULLS LAST,code',[p.id])).rows;
  const parent_options=(await db.query(`WITH RECURSIVE descendants AS (
   SELECT id FROM places WHERE parent_place_id=$1
   UNION ALL SELECT child.id FROM places child JOIN descendants d ON child.parent_place_id=d.id
  ) SELECT code,name,region FROM places WHERE id<>$1 AND deleted_at IS NULL AND duplicate_of_place_id IS NULL AND id NOT IN(SELECT id FROM descendants) ORDER BY corridor_order ASC NULLS LAST,code`,[p.id])).rows;
  return {children,parent_options,children_token:childToken(children)};
 });
 app.post('/api/admin/places/:code/delete',{schema:{params,body:{type:'object',additionalProperties:false,required:['expected_updated_at','child_action'],properties:{expected_children_token:{type:'string',pattern:'^[a-f0-9]{64}$'},expected_updated_at:{type:'string',format:'date-time'},child_action:{type:'string',enum:['detach','transfer']},new_parent_code:{type:['string','null'],pattern:'^WY-[0-9]{4,}$'}}}}},async req=>{
  const code=(req.params as {code:string}).code,input=req.body as {expected_children_token?:string;expected_updated_at:string;child_action:'detach'|'transfer';new_parent_code?:string|null},c=await db.connect();
  try{await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(91724001)');
   const p=(await c.query('SELECT id,code,name,updated_at,deleted_at FROM places WHERE code=$1 FOR UPDATE',[code])).rows[0];if(!p)throw new CoordinateError(404,'地点不存在');
   if(p.deleted_at)throw new CoordinateError(409,'地点已在回收站，请刷新页面');
   if(new Date(p.updated_at).toISOString()!==new Date(input.expected_updated_at).toISOString())throw new CoordinateError(409,'地点资料已变化，请取消后刷新并重新核对');
   const children=(await c.query('SELECT id,code,name,updated_at FROM places WHERE parent_place_id=$1 AND deleted_at IS NULL ORDER BY corridor_order ASC NULLS LAST,code FOR UPDATE',[p.id])).rows;
   if((children.length||input.expected_children_token)&&input.expected_children_token!==childToken(children))throw new CoordinateError(409,'子地点已变化或尚未完成预览，请取消后重新核对');
   const duplicates=(await c.query('SELECT code,name FROM places WHERE duplicate_of_place_id=$1 AND deleted_at IS NULL ORDER BY code',[p.id])).rows;
   if(duplicates.length)throw new CoordinateError(409,`该地点仍被重复档案引用：${duplicates.map(x=>x.code).join('、')}`);
   let childNote='无未删除子地点';
   if(children.length&&input.child_action==='detach'){
    await c.query('UPDATE places SET parent_place_id=NULL WHERE parent_place_id=$1 AND deleted_at IS NULL',[p.id]);childNote=`已解除 ${children.length} 个子地点的父级关系`;
   }else if(children.length){
    if(!input.new_parent_code)throw new CoordinateError(400,'请选择新的父地点');
    const target=(await c.query('SELECT id,code,name FROM places WHERE code=$1 AND deleted_at IS NULL AND duplicate_of_place_id IS NULL FOR UPDATE',[input.new_parent_code])).rows[0];
    if(!target)throw new CoordinateError(409,'新的父地点不存在、已删除或不是有效地点');
    const invalid=(await c.query(`WITH RECURSIVE descendants AS (
     SELECT id FROM places WHERE parent_place_id=$1
     UNION ALL SELECT child.id FROM places child JOIN descendants d ON child.parent_place_id=d.id
    ) SELECT 1 FROM descendants WHERE id=$2`,[p.id,target.id])).rowCount;
    if(target.id===p.id||invalid)throw new CoordinateError(409,'新的父地点不能是当前地点或其后代地点');
    await c.query('UPDATE places SET parent_place_id=$1 WHERE parent_place_id=$2 AND deleted_at IS NULL',[target.id,p.id]);childNote=`${children.length} 个子地点已转移至 ${target.code} ${target.name}`;
   }
   const row=(await c.query("UPDATE places SET deleted_at=now(),deleted_by='internal_admin_ui',deletion_reason=$2 WHERE id=$1 RETURNING code,name,deleted_at",[p.id,`用户从内部后台移入回收站；${childNote}`])).rows[0];
   await c.query('COMMIT');return row;
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 });
 app.post('/api/admin/places/:code/restore',{schema:{params,body:{type:'object',additionalProperties:false,required:['expected_deleted_at'],properties:{expected_deleted_at:{type:'string',format:'date-time'}}}}},async req=>{
  const code=(req.params as {code:string}).code,expected=(req.body as {expected_deleted_at:string}).expected_deleted_at,c=await db.connect();
  try{await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(91724001)');
   const p=(await c.query('SELECT id,parent_place_id,duplicate_of_place_id,deleted_at FROM places WHERE code=$1 FOR UPDATE',[code])).rows[0];if(!p)throw new CoordinateError(404,'地点不存在');
   if(!p.deleted_at)throw new CoordinateError(409,'地点已不在回收站，请刷新页面');
   if(new Date(p.deleted_at).toISOString()!==new Date(expected).toISOString())throw new CoordinateError(409,'回收站状态已变化，请刷新后重试');
   if(p.parent_place_id&&(await c.query('SELECT 1 FROM places WHERE id=$1 AND deleted_at IS NOT NULL',[p.parent_place_id])).rowCount)throw new CoordinateError(409,'请先恢复父地点');
   if(p.duplicate_of_place_id&&(await c.query('SELECT 1 FROM places WHERE id=$1 AND deleted_at IS NOT NULL',[p.duplicate_of_place_id])).rowCount)throw new CoordinateError(409,'请先恢复该重复档案指向的保留地点');
   await c.query("SELECT set_config('app.place_recycle_source','internal_admin_ui',true)");
   const row=(await c.query('UPDATE places SET deleted_at=NULL,deleted_by=NULL,deletion_reason=NULL WHERE id=$1 RETURNING code,name,updated_at',[p.id])).rows[0];
   await c.query('COMMIT');return row;
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 });
}
