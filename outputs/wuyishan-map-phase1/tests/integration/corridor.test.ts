import 'dotenv/config';
import {test} from 'node:test';import assert from 'node:assert/strict';import pg from 'pg';import {randomUUID} from 'node:crypto';import {readFile,readdir} from 'node:fs/promises';
import {createApp} from '../../backend/src/app.js';
import {apply,preview,snapshot} from '../../backend/src/importer.js';
import {applyCorridorData} from '../../backend/src/corridor-data.js';
import {addCandidate,confirmCandidate} from '../../backend/src/coordinates.js';
import {checkDatabase} from '../../backend/src/checks.js';
import {visibleMapPlaces} from '../../shared/coordinates.js';
test('一号风景道已确认数据整理、独立排序和保护回归',async t=>{
 const admin=new pg.Pool({connectionString:process.env.DATABASE_URL}),name=`wymap_test_${randomUUID().replaceAll('-','')}`;
 await admin.query(`CREATE DATABASE ${name}`);const url=new URL(process.env.DATABASE_URL!);url.pathname='/'+name;
 const db=new pg.Pool({connectionString:url.toString()}),app=createApp(db);
 const list=async(path='/api/admin/places?page_size=100')=>(await app.inject({url:path})).json();
 const copy=(v:any)=>JSON.parse(JSON.stringify(v));
 try{
  for(const f of (await readdir('database/migrations')).filter(n=>n.endsWith('.sql')).sort())await db.query(await readFile(`database/migrations/${f}`,'utf8'));
  const file='sources/武夷山奶爸地图_主数据库_V1.2.xlsx';await apply(db,await preview(file,await snapshot(db)),file);
  // Only isolated fixture coordinates; never run this against the live database.
  for(const code of ['WY-0001','WY-0004','WY-0005','WY-0016']){
   const c=await addCandidate(db,code,{latitude:27.76,longitude:117.99,coordinate_system:'GCJ-02',accuracy_meters:null,source_type:'map_click',source_time:'2026-09-09T00:00:00Z'});await confirmCandidate(db,code,c.id,null);
  }
  const protectedTables=['coordinate_candidates','place_coordinates','verifications','route_stops','routes','guide_places','guides'];
  const protectedBefore:Record<string,any>={};for(const table of protectedTables)protectedBefore[table]=(await db.query(`SELECT * FROM ${table} ORDER BY 1`)).rows;
  const baseline={places:copy((await db.query('SELECT * FROM places ORDER BY code')).rows)};
  await t.test('备份后发生修改时拒绝整批写入，不机械覆盖',async()=>{
   const bad=copy(baseline);bad.places[0].name='冲突';await assert.rejects(applyCorridorData(db,bad),/已变化/);
   assert.equal((await db.query('SELECT count(*)::int n FROM places')).rows[0].n,46);
  });
  const result=await applyCorridorData(db,baseline);
  await t.test('保留46旧编号，新增15条，60当前地点和1重复档案；全部新点零坐标',async()=>{
   assert.deepEqual(result.counts,{total:61,canonical:60,ranked:58,unranked:2});
   assert.equal(result.changes.filter(r=>r.type==='new').length,15);
   const all=(await db.query('SELECT * FROM places')).rows;
   for(const old of baseline.places)assert.equal(all.find(r=>r.code===old.code).id,old.id);
   assert.equal((await db.query("SELECT count(*)::int n FROM coordinate_candidates c JOIN places p ON p.id=c.matched_place_id WHERE substring(p.code from 4)::int>46")).rows[0].n,0);
   assert.equal((await db.query("SELECT count(*)::int n FROM places WHERE code='WY-0054'")).rows[0].n,0);
  });
  await t.test('30核心顺序严格一致；新增分岔口位于馆和支线之间；待排只在末尾',async()=>{
   const manifest=JSON.parse(await readFile('database/corridor-v1.json','utf8')),items=(await list()).items;
   assert.deepEqual(items.filter((r:any)=>manifest.anchors.includes(r.code)).map((r:any)=>r.code),manifest.anchors);
   assert.deepEqual(items.slice(-2).map((r:any)=>r.code),['WY-0019','WY-0034']);
   const index=(code:string)=>items.findIndex((r:any)=>r.code===code);assert(index('WY-0040')<index('WY-0062'));assert(index('WY-0062')<index('WY-0058'));
   const queue=await list('/api/admin/coordinate-queue');assert.equal(queue.next.code,'WY-0002');
   assert.equal((await list('/api/admin/coordinate-queue?after=WY-0040')).next.code,'WY-0038');
   assert.equal((await list('/api/admin/coordinate-queue?after=WY-0061')).next.code,'WY-0019');
   assert.equal((await list('/api/admin/coordinate-queue?after=WY-0019')).next.code,'WY-0034');
  });
  await t.test('改名与黄村父级调整准确；空父级允许；不改其他旧父级、区域或公开等级',async()=>{
   const all=(await db.query('SELECT p.*,parent.code parent_code FROM places p LEFT JOIN places parent ON parent.id=p.parent_place_id')).rows;
   const tea=all.find(p=>p.code==='WY-0040');assert.equal(tea.name,'黄村乌龙茶展示馆');assert.equal(tea.region,'黄村');assert.equal(tea.parent_code,'WY-0010');
   for(const old of baseline.places){const now=all.find(p=>p.id===old.id);assert.equal(now.public_level,old.public_level);if(old.code!=='WY-0040'){assert.equal(now.parent_place_id,old.parent_place_id);assert.equal(now.region,old.region);}}
   for(const code of ['WY-0060','WY-0061'])assert.equal(all.find(p=>p.code===code).parent_place_id,null);
   for(const code of ['WY-0038','WY-0058','WY-0059','WY-0062'])assert.equal(all.find(p=>p.code===code).corridor_role,'branch');
   assert.equal(all.find(p=>p.code==='WY-0061').current_status,'在建');
  });
  await t.test('所有原坐标、候选、核验、路线站点和攻略关系逐行不变',async()=>{
   for(const table of protectedTables)assert.deepEqual((await db.query(`SELECT * FROM ${table} ORDER BY 1`)).rows,protectedBefore[table],table);
   await assert.rejects(applyCorridorData(db,baseline),/已变化|数量已变化/);
  });
  await t.test('集合角色只预览不擅自赋值；重复档案可查、攻略可达且不进入判点队列',async()=>{
   assert.equal(result.rolesApplied,false);assert((await db.query('SELECT map_display_role FROM places')).rows.every(p=>p.map_display_role==='pin'));
   assert.equal((await list('/api/admin/places?archive=duplicates')).items[0].code,'WY-0042');
   const old=await list('/api/admin/places/WY-0042');assert.equal(old.duplicate.code,'WY-0041');
   const canonical=await list('/api/admin/places/WY-0041');assert(canonical.guides.some((g:any)=>g.code==='G-0007'));assert(canonical.guides.some((g:any)=>g.code==='G-0008'));
   await assert.rejects(addCandidate(db,'WY-0042',{latitude:27,longitude:117,coordinate_system:'GCJ-02',accuracy_meters:null,source_type:'map_click',source_time:'2026-09-09T00:00:00Z'}),/重复档案/);
  });
  await t.test('手动排序只改corridor_order；上移下移不改任何其他字段；非法/占号/过期请求拒绝',async()=>{
   const before=(await db.query('SELECT * FROM places ORDER BY code')).rows;
   const post=(suffix:string,payload:any)=>app.inject({method:'POST',url:'/api/admin/places/WY-0047/'+suffix,payload});
   assert.equal((await post('corridor-order',{order:305,expected_order:310})).statusCode,200);
   assert.equal((await post('corridor-order',{order:300,expected_order:305})).statusCode,409);
   assert.equal((await post('corridor-order',{order:-1,expected_order:305})).statusCode,400);
   assert.equal((await post('corridor-order',{order:306,expected_order:310})).statusCode,409);
   assert.equal((await post('corridor-order',{order:306,expected_order:305,name:'不允许改名'})).statusCode,400);
   assert.equal((await post('corridor-move',{direction:'up',expected_order:305})).statusCode,200);
   assert.equal((await post('corridor-move',{direction:'down',expected_order:300})).statusCode,200);
   const after=(await db.query('SELECT * FROM places ORDER BY code')).rows;
   const strip=(rows:any[])=>rows.map(({corridor_order,...r})=>r);assert.deepEqual(strip(after),strip(before));
   assert.equal((await post('corridor-order',{order:310,expected_order:305})).statusCode,200);
  });
  await t.test('P2—P5有效坐标仍不公开，在建/未确认也不公开；地图group/hidden不绕过确认门槛',async()=>{
   const code='WY-0061';const c=await addCandidate(db,code,{latitude:27.7,longitude:117.9,coordinate_system:'GCJ-02',accuracy_meters:null,source_type:'map_click',source_time:'2026-09-09T00:00:00Z'});await confirmCandidate(db,code,c.id,null);
   await db.query("UPDATE places SET public_level='P1' WHERE code='WY-0061'");
   assert.equal((await list('/api/places/WY-0061')).latitude,null);
   assert.equal((await list('/api/places/WY-0004')).latitude,null);assert.equal((await list('/api/places/WY-0005')).latitude,null);assert.equal((await list('/api/places/WY-0016')).latitude,null);
   assert.equal((await app.inject({url:'/api/places/WY-0048'})).statusCode,404);
   assert.equal((await list('/api/places/WY-0002')).latitude,null);
   await db.query("UPDATE places SET map_display_role='group' WHERE code IN ('WY-0001','WY-0006')");
   await db.query("UPDATE places SET map_display_role='hidden' WHERE code='WY-0004'");
   const map=(await list('/api/admin/map-places')).items;
   assert(map.some((p:any)=>p.code==='WY-0001'&&p.map_display_role==='group'));assert(!map.some((p:any)=>['WY-0004','WY-0006','WY-0042'].includes(p.code)));
   assert.equal((await list('/api/admin/map-places?status='+encodeURIComponent('在建'))).items[0].code,'WY-0061');
   const fixture=[{code:'p',ancestor_codes:[],map_display_role:'group' as const},{code:'c',ancestor_codes:['p'],map_display_role:'pin' as const},{code:'h',ancestor_codes:[],map_display_role:'hidden' as const}];
   assert.deepEqual(visibleMapPlaces(fixture,12).map(p=>p.code),['p']);assert.deepEqual(visibleMapPlaces(fixture,15).map(p=>p.code),['p','c']);
   assert((await checkDatabase(db)).passed);
  });
 }finally{await app.close();await db.end();await admin.query(`DROP DATABASE ${name} WITH (FORCE)`);await admin.end();}
});
