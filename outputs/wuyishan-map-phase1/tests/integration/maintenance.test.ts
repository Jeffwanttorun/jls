import 'dotenv/config';import {test} from 'node:test';import assert from 'node:assert/strict';import pg from 'pg';import {randomUUID} from 'node:crypto';import {readFile,readdir} from 'node:fs/promises';
import {createApp} from '../../backend/src/app.js';import {addCandidate,confirmCandidate} from '../../backend/src/coordinates.js';import {apply,preview,snapshot} from '../../backend/src/importer.js';import {checkDatabase} from '../../backend/src/checks.js';
test('后台自助改名与删除定位：独立真实数据库',async t=>{
 const admin=new pg.Pool({connectionString:process.env.DATABASE_URL}),name=`wymap_test_${randomUUID().replaceAll('-','')}`;await admin.query(`CREATE DATABASE ${name}`);const url=new URL(process.env.DATABASE_URL!);url.pathname='/'+name;const db=new pg.Pool({connectionString:url.toString()}),app=createApp(db);
 const post=(path:string,payload:any)=>app.inject({method:'POST',url:path,payload});const get=async(path:string)=>(await app.inject({url:path})).json();const code='WY-0024';
 const add=async(place=code,lat=27.76,expected:string|null=null)=>{const candidate=await addCandidate(db,place,{latitude:lat,longitude:117.99,coordinate_system:'GCJ-02',source_type:'map_click',source_reference:'隔离测试',accuracy_meters:null,source_time:'2026-09-09T00:00:00Z'});return confirmCandidate(db,place,candidate.id,expected);};
 try{
  for(const f of (await readdir('database/migrations')).filter(n=>n.endsWith('.sql')).sort())await db.query(await readFile(`database/migrations/${f}`,'utf8'));
  const source='sources/武夷山奶爸地图_主数据库_V1.2.xlsx';await apply(db,await preview(source,await snapshot(db)),source);await db.query("UPDATE places SET corridor_order=substring(code from 4)::int*100 WHERE code IN ('WY-0024','WY-0025')");
  const p=(await db.query('SELECT * FROM places WHERE code=$1',[code])).rows[0];
  const formal=await add();
  await t.test('删除唯一active：只撤销坐标，地点/编号/UUID不变，退出地图与公开定位并回到队列',async()=>{
   const result=await post(`/api/admin/places/${code}/location/delete`,{expected_current_id:formal.id});assert.equal(result.statusCode,200,result.body);assert.equal(result.json().status,'revoked');
   assert.deepEqual((await db.query('SELECT * FROM places WHERE code=$1',[code])).rows[0],p);
   const detail=await get('/api/admin/places/'+code);assert.equal(detail.coordinates.length,1);assert.equal(detail.coordinates[0].status,'revoked');assert.equal(detail.coordinates[0].raw_latitude,formal.raw_latitude);
   assert(!(await get('/api/admin/map-places')).items.some((p:any)=>p.code===code));assert.equal((await get('/api/places/'+code)).latitude,null);assert.equal((await get('/api/admin/coordinate-queue')).next.code,code);
  });
  let replacement:any;
  await t.test('删除后重新判点生成新active；revoked历史不复活、不删除',async()=>{
   replacement=await add(code,27.77);const rows=(await db.query('SELECT * FROM place_coordinates WHERE place_id=$1 ORDER BY created_at',[p.id])).rows;assert.equal(rows.length,2);assert.deepEqual(rows.map(r=>r.status),['revoked','active']);assert.equal(rows[0].id,formal.id);
   assert.equal((await post(`/api/admin/places/${code}/location/delete`,{expected_current_id:formal.id})).statusCode,409);assert.equal((await post(`/api/admin/places/${code}/location/delete`,{})).statusCode,400);
   assert.equal((await get('/api/admin/places/'+code)).coordinates.find((c:any)=>c.status==='active').id,replacement.id);
  });
  await t.test('并发删除只有一次成功；旧确认不能删除新定位；历史superseded也不可删除',async()=>{
   const results=await Promise.all([1,2].map(()=>post(`/api/admin/places/${code}/location/delete`,{expected_current_id:replacement.id})));assert.deepEqual(results.map(r=>r.statusCode).sort(),[200,409]);
   const next=await add(code,27.78);assert.equal((await post(`/api/admin/places/${code}/location/delete`,{expected_current_id:replacement.id})).statusCode,409);
   const newer=await add(code,27.79,next.id);assert.equal((await post(`/api/admin/places/${code}/location/delete`,{expected_current_id:next.id})).statusCode,409);assert.equal((await get('/api/admin/places/'+code)).coordinates.find((c:any)=>c.status==='active').id,newer.id);
   await assert.rejects(db.query('DELETE FROM place_coordinates WHERE id=$1',[formal.id]),/immutable|delete/i);
  });
  const guarded=['place_coordinates','coordinate_candidates','verifications','route_stops','route_place_links','guides','guide_places','guide_routes','media','place_practical_info','place_accessibility'];const original:Record<string,any>={};for(const table of guarded)original[table]=(await db.query(`SELECT * FROM ${table} ORDER BY 1`)).rows;
  const oldPlaces=(await db.query('SELECT * FROM places ORDER BY code')).rows;
  await t.test('普通改名及连续改名，所有关联和地点身份字段不变',async()=>{
   const target='WY-0025',old=oldPlaces.find(p=>p.code===target);
   for(const [expected_name,name] of [[old.name,'桃源峪访客停车点'],['桃源峪访客停车点','桃源峪入口停车处']]){const r=await post(`/api/admin/places/${target}/name`,{expected_name,name});assert.equal(r.statusCode,200,r.body);}
   const history=(await get('/api/admin/places/'+target)).name_history;assert.equal(history.length,2);assert(history.every((h:any)=>h.change_source==='admin_ui'&&Date.parse(h.changed_at)));
   const after=(await db.query('SELECT * FROM places ORDER BY code')).rows;for(let i=0;i<after.length;i++){const {name,updated_at,...rest}=after[i],{name:oldName,updated_at:oldTime,...oldRest}=oldPlaces[i];assert.deepEqual(rest,oldRest);if(after[i].code!==target)assert.deepEqual(after[i],oldPlaces[i]);}
   for(const table of guarded)assert.deepEqual((await db.query(`SELECT * FROM ${table} ORDER BY 1`)).rows,original[table],table);
  });
  await t.test('当前名称及所有历史名称均搜索到同一地点；通配符按文字处理',async()=>{
   for(const q of ['桃源峪停车位置','桃源峪访客停车点','桃源峪入口停车处']){const result=await get('/api/admin/places?q='+encodeURIComponent(q));assert.equal(result.total,1);assert.equal(result.items[0].code,'WY-0025');assert.equal(result.items[0].name,'桃源峪入口停车处');}
   assert.equal((await get('/api/admin/places?q=%25')).total,0);assert.equal((await get('/api/admin/places?q='+encodeURIComponent("' OR 1=1--"))).total,0);
  });
  await t.test('空白/超长拒绝，原名保存不产生历史，过期页面拒绝，同区域重名仅警告',async()=>{
   const target='WY-0025',expected_name='桃源峪入口停车处',path=`/api/admin/places/${target}/name`;
   for(const name of ['', '   ','　','A'.repeat(121),'abc\nabc'])assert.equal((await post(path,{name,expected_name})).statusCode,400);
   assert.equal((await post(path,{name:expected_name,expected_name})).statusCode,200);assert.equal((await get('/api/admin/places/'+target)).name_history.length,2);
   assert.equal((await post(path,{name:'另一个名称',expected_name:'旧页面'})).statusCode,409);
   assert.equal((await post(path,{name:'不能改编号',expected_name,code:'WY-9999'})).statusCode,400);
   const preview=await get(`/api/admin/places/${target}/name-conflicts?name=`+encodeURIComponent('桃源峪'));assert(preview.items.some((p:any)=>p.code===code));
   const same=await post(path,{name:' 桃源峪 ',expected_name});assert.equal(same.statusCode,200);assert.equal(same.json().name,'桃源峪');assert(same.json().warnings.some((p:any)=>p.code===code));
   assert.equal((await get('/api/admin/places?q='+encodeURIComponent('桃源峪停车位置'))).items[0].code,target);
  });
  await t.test('名称历史不可篡改，直接SQL改名也有审计；原时间与坐标安全检查通过',async()=>{
   const h=(await db.query('SELECT id FROM place_name_history LIMIT 1')).rows[0];await assert.rejects(db.query('DELETE FROM place_name_history WHERE id=$1',[h.id]),/immutable/);await assert.rejects(db.query("UPDATE place_name_history SET old_name='篡改' WHERE id=$1",[h.id]),/immutable/);
   await db.query("UPDATE places SET name='直接SQL改名测试' WHERE code='WY-0026'");assert.equal((await get('/api/admin/places/WY-0026')).name_history[0].change_source,'database_update');
   assert((await checkDatabase(db)).passed);
  });
 }finally{await app.close();await db.end();await admin.query(`DROP DATABASE ${name} WITH (FORCE)`);await admin.end();}
});
