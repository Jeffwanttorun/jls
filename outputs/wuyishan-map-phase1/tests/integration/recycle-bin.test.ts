import 'dotenv/config';import {test} from 'node:test';import assert from 'node:assert/strict';import pg from 'pg';import {randomUUID} from 'node:crypto';import {readFile,readdir} from 'node:fs/promises';
import {createApp} from '../../backend/src/app.js';import {addCandidate,confirmCandidate} from '../../backend/src/coordinates.js';import {apply,preview,snapshot} from '../../backend/src/importer.js';import {checkDatabase} from '../../backend/src/checks.js';

test('地点软删除与回收站：独立 PostgreSQL 数据库回归',async t=>{
 const admin=new pg.Pool({connectionString:process.env.DATABASE_URL}),name=`wymap_recycle_${randomUUID().replaceAll('-','')}`;await admin.query(`CREATE DATABASE ${name}`);const url=new URL(process.env.DATABASE_URL!);url.pathname='/'+name;const db=new pg.Pool({connectionString:url.toString()}),app=createApp(db);
 const get=async(path:string)=>app.inject({url:path}),post=(path:string,payload:any)=>app.inject({method:'POST',url:path,payload});let code='';
 try{
  for(const f of (await readdir('database/migrations')).filter(n=>n.endsWith('.sql')).sort())await db.query(await readFile(`database/migrations/${f}`,'utf8'));
  const source='sources/武夷山奶爸地图_主数据库_V1.2.xlsx';await apply(db,await preview(source,await snapshot(db)),source);
  const place=(await db.query("SELECT p.* FROM places p WHERE p.duplicate_of_place_id IS NULL AND p.public_level='P1' AND p.current_status='正常' AND NOT EXISTS(SELECT 1 FROM places child WHERE child.parent_place_id=p.id AND child.deleted_at IS NULL) AND NOT EXISTS(SELECT 1 FROM places duplicate WHERE duplicate.duplicate_of_place_id=p.id AND duplicate.deleted_at IS NULL) ORDER BY EXISTS(SELECT 1 FROM route_stops s WHERE s.place_id=p.id) DESC,p.code LIMIT 1")).rows[0];assert(place);code=place.code;
  await post(`/api/admin/places/${code}/name`,{name:'回收站隔离测试地点',expected_name:place.name});
  const currentPlace=(await db.query('SELECT * FROM places WHERE code=$1',[code])).rows[0];
  const candidate=await addCandidate(db,code,{latitude:27.76,longitude:117.99,coordinate_system:'GCJ-02',accuracy_meters:null,source_type:'map_click',source_reference:'独立测试库',source_time:'2026-09-09T00:00:00Z'});await confirmCandidate(db,code,candidate.id,null);
  const preservedTables=['place_coordinates','coordinate_candidates','place_name_history','verifications','route_stops','route_place_links','guide_places','media'];
  const preserved:Record<string,any[]>=Object.fromEntries(await Promise.all(preservedTables.map(async table=>[table,(await db.query(`SELECT * FROM ${table} WHERE ${table==='coordinate_candidates'?'matched_place_id':'place_id'}=$1 ORDER BY 1`,[place.id])).rows])));
  assert.equal(preserved.place_coordinates.length,1);assert.equal(preserved.place_name_history.length,1);assert(preserved.route_stops.length+preserved.route_place_links.length>0,'测试地点必须带有路线关联');
  const immutable={id:currentPlace.id,code:currentPlace.code,name:currentPlace.name,parent_place_id:currentPlace.parent_place_id,corridor_order:currentPlace.corridor_order,duplicate_of_place_id:currentPlace.duplicate_of_place_id};

  await t.test('一次确认接口软删除；并发只有一次成功',async()=>{
   const results=await Promise.all([1,2].map(()=>post(`/api/admin/places/${code}/delete`,{expected_updated_at:new Date(currentPlace.updated_at).toISOString(),child_action:'detach'})));
   assert.deepEqual(results.map(r=>r.statusCode).sort(),[200,409]);
   const row=(await db.query('SELECT * FROM places WHERE id=$1',[place.id])).rows[0];assert(row.deleted_at);assert.equal(row.deleted_by,'internal_admin_ui');
   assert.deepEqual({id:row.id,code:row.code,name:row.name,parent_place_id:row.parent_place_id,corridor_order:row.corridor_order,duplicate_of_place_id:row.duplicate_of_place_id},immutable);
  });
  await t.test('回收站之外全部隐藏，坐标及关联原样保留，删除状态不可继续维护',async()=>{
   assert.equal((await get('/api/admin/places/'+code)).statusCode,404);assert(!(await get('/api/admin/places')).json().items.some((p:any)=>p.code===code));
   assert(!(await get('/api/admin/map-places')).json().items.some((p:any)=>p.code===code));const queue=(await get('/api/admin/coordinate-queue')).json();const expectedQueue=Number((await db.query("SELECT count(*) n FROM places p WHERE p.deleted_at IS NULL AND p.duplicate_of_place_id IS NULL AND NOT EXISTS(SELECT 1 FROM confirmed_place_coordinates c WHERE c.place_id=p.id)")).rows[0].n);assert.equal(queue.remaining,expectedQueue);
   assert.equal((await get('/api/places/'+code)).statusCode,404);const recycle=(await get('/api/admin/recycle-bin?q='+code)).json();assert.equal(recycle.items[0].code,code);assert.equal(recycle.items[0].coordinate_history_count,1);assert.equal(recycle.items[0].name_history_count,1);assert.equal((await get('/api/admin/recycle-bin?q='+encodeURIComponent(place.name))).json().items[0].code,code);
   assert.equal((await post(`/api/admin/places/${code}/coordinate-candidates`,{latitude:27.7,longitude:117.9,coordinate_system:'GCJ-02',accuracy_meters:null,source_type:'map_click',source_time:new Date().toISOString()})).statusCode,404);
   for(const table of preservedTables){const column=table==='coordinate_candidates'?'matched_place_id':'place_id';assert.deepEqual((await db.query(`SELECT * FROM ${table} WHERE ${column}=$1 ORDER BY 1`,[place.id])).rows,preserved[table],table);}
  });
  await t.test('恢复后原编号、排序、正式坐标和所有关联直接恢复可见',async()=>{
   const deleted=(await db.query('SELECT deleted_at FROM places WHERE id=$1',[place.id])).rows[0].deleted_at;
   assert.equal((await post(`/api/admin/places/${code}/restore`,{expected_deleted_at:new Date(deleted).toISOString()})).statusCode,200);
   const row=(await db.query('SELECT * FROM places WHERE id=$1',[place.id])).rows[0];assert.equal(row.deleted_at,null);assert.deepEqual({id:row.id,code:row.code,name:row.name,parent_place_id:row.parent_place_id,corridor_order:row.corridor_order,duplicate_of_place_id:row.duplicate_of_place_id},immutable);
   assert.equal((await get('/api/admin/places/'+code)).statusCode,200);assert((await get('/api/admin/map-places')).json().items.some((p:any)=>p.code===code));assert.equal((await get('/api/places/'+code)).statusCode,200);
   for(const table of preservedTables){const column=table==='coordinate_candidates'?'matched_place_id':'place_id';assert.deepEqual((await db.query(`SELECT * FROM ${table} WHERE ${column}=$1 ORDER BY 1`,[place.id])).rows,preserved[table],table);}
  });
  await t.test('物理删除和回收审计篡改被数据库阻止',async()=>{
   await assert.rejects(db.query('DELETE FROM places WHERE id=$1',[place.id]),/physically deleted|recycle bin/i);
   const history=(await db.query('SELECT * FROM place_recycle_history WHERE place_id=$1 ORDER BY occurred_at',[place.id])).rows;assert.deepEqual(history.map(h=>h.action),['deleted','restored']);
   await assert.rejects(db.query('DELETE FROM place_recycle_history WHERE id=$1',[history[0].id]),/immutable/i);
  });
  await t.test('P2—P5保护与全库完整性回归',async()=>{const pub=(await get('/api/places')).json().items;assert(pub.every((p:any)=>p.public_level!=='P5'&&(!['P2','P3','P4'].includes(p.public_level)||(p.latitude===null&&p.longitude===null))));assert.equal((await checkDatabase(db)).passed,true);});
 }finally{await app.close();await db.end();await admin.query(`DROP DATABASE ${name} WITH (FORCE)`);await admin.end();}
});
