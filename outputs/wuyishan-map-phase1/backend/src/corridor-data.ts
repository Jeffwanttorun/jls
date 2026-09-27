import type {Pool} from 'pg';
import {readFile} from 'node:fs/promises';
export async function applyCorridorData(db:Pool,baseline:any,applyRoles=false){
 const manifest=JSON.parse(await readFile('database/corridor-v1.json','utf8'));
 const c=await db.connect();
 try{
  await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(91724001)');
  await c.query('LOCK TABLE places IN SHARE ROW EXCLUSIVE MODE');
  const existing=(await c.query('SELECT * FROM places ORDER BY code')).rows;
  const existingByCode=new Map(existing.map(p=>[p.code,p]));
  const changes:any[]=[];
  // Compare all original fields against the pre-write snapshot. Never overwrite an intervening edit.
  for(const old of baseline.places){
   const actual=existingByCode.get(old.code);if(!actual)throw Error(`原地点缺失 ${old.code}`);
   for(const key of Object.keys(actual)){
    if(!(key in old))continue;
    const a=actual[key] instanceof Date?actual[key].toISOString():actual[key];
    const b=old[key];if(JSON.stringify(a)!==JSON.stringify(b))throw Error(`备份后地点已变化 ${old.code}.${key}，请重新预览备份`);
   }
  }
  if(existing.length!==baseline.places.length)throw Error('备份后地点数量已变化，停止写入');
  for(const row of manifest.rows.filter((r:any)=>!existingByCode.has(r.code))){
   if((await c.query('SELECT 1 FROM places WHERE name=$1',[row.name])).rowCount)throw Error(`新名称已存在 ${row.name}`);
   const parent=row.parent_code?(await c.query('SELECT id FROM places WHERE code=$1',[row.parent_code])).rows[0]?.id:null;
   if(row.parent_code&&!parent)throw Error(`新地点父级不存在 ${row.code}`);
   const category=(await c.query("SELECT id FROM taxonomy_terms WHERE dimension='一级分类' AND code=$1 AND enabled",[row.category_code])).rows[0]?.id;
   if(!category)throw Error(`缺少分类 ${row.category_code}`);
   await c.query('INSERT INTO places(code,name,place_type,parent_place_id,category_id,region,current_status,public_level,priority) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[row.code,row.name,row.place_type,parent,category,row.region,row.current_status,row.public_level,row.priority]);
   changes.push({type:'new',...row});
  }
  // Preserve all old records and links for the confirmed duplicate; canonical detail includes its guides.
  const duplicate=(await c.query('SELECT id FROM places WHERE code=$1',[manifest.duplicate.code])).rows[0];
  for(const [table,column] of [['place_coordinates','place_id'],['coordinate_candidates','matched_place_id'],['verifications','place_id']]){
   if((await c.query(`SELECT 1 FROM ${table} WHERE ${column}=$1`,[duplicate.id])).rowCount)throw Error('重复馆已产生坐标或核验记录，需要重新人工检查');
  }
  await c.query('UPDATE places SET duplicate_of_place_id=(SELECT id FROM places WHERE code=$1),corridor_order=NULL WHERE code=$2',[manifest.duplicate.canonical,manifest.duplicate.code]);
  for(const row of manifest.rows){
   const old=existingByCode.get(row.code);
   if(old&&old.name!==row.name){await c.query('UPDATE places SET name=$1 WHERE code=$2',[row.name,row.code]);changes.push({type:'rename',code:row.code,before:old.name,after:row.name});}
   if(row.code==='WY-0040')await c.query("UPDATE places SET parent_place_id=(SELECT id FROM places WHERE code='WY-0010'),region='黄村' WHERE code='WY-0040'");
   await c.query('UPDATE places SET corridor_order=$1,corridor_role=$2 WHERE code=$3',[row.corridor_order,row.corridor_role,row.code]);
  }
  if(applyRoles)for(const [code,role] of Object.entries(manifest.suggested_map_roles))await c.query('UPDATE places SET map_display_role=$1 WHERE code=$2',[role,code]);
  await c.query("INSERT INTO taxonomy_terms(dimension,code,name,description) VALUES('当前状态','UNDER_CONSTRUCTION','在建','尚未建成，不属于正常开放；区别于既有设施施工') ON CONFLICT(dimension,name) DO NOTHING");
  const ranked=(await c.query('SELECT code FROM places WHERE corridor_order IS NOT NULL ORDER BY corridor_order')).rows.map(p=>p.code);
  const anchors=ranked.filter(code=>manifest.anchors.includes(code));
  if(JSON.stringify(anchors)!==JSON.stringify(manifest.anchors))throw Error('30个权威核心节点顺序不一致');
  const counts=(await c.query('SELECT count(*)::int total,count(*) FILTER(WHERE duplicate_of_place_id IS NULL)::int canonical,count(*) FILTER(WHERE corridor_order IS NOT NULL)::int ranked,count(*) FILTER(WHERE corridor_order IS NULL AND duplicate_of_place_id IS NULL)::int unranked FROM places')).rows[0];
  await c.query('COMMIT');return {appliedAt:new Date().toISOString(),counts,changes,duplicate:manifest.duplicate,rolesApplied:applyRoles,rolePreview:manifest.suggested_map_roles,anchors};
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
