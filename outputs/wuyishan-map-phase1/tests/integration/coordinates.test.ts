import 'dotenv/config';
import {test} from 'node:test';import assert from 'node:assert/strict';import pg from 'pg';import {randomUUID} from 'node:crypto';import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createApp} from '../../backend/src/app.js';import {checkDatabase} from '../../backend/src/checks.js';
test('第二阶段真实数据库坐标生命周期与安全',async t=>{
 const admin=new pg.Pool({connectionString:process.env.DATABASE_URL}),name=`wymap_test_${randomUUID().replaceAll('-','')}`;
 await admin.query(`CREATE DATABASE ${name}`);const url=new URL(process.env.DATABASE_URL!);url.pathname='/'+name;
 const db=new pg.Pool({connectionString:url.toString()});const app=createApp(db);
 const post=(path:string,payload:unknown)=>app.inject({method:'POST',url:path,payload:payload as any});
 const basic={latitude:27.76,longitude:117.99,coordinate_system:'GCJ-02',accuracy_meters:null,source_type:'manual_input',source_time:'2026-09-05T08:00:00Z'};
 const add=async(code:string,extra={})=>{const r=await post(`/api/admin/places/${code}/coordinate-candidates`,{...basic,...extra});assert.equal(r.statusCode,201,r.body);return r.json();};
 const confirm=(code:string,id:string,expected:string|null=null)=>post(`/api/admin/places/${code}/coordinate-candidates/${id}/confirm`,{expected_current_id:expected,acknowledged:true});
 let first:any,second:any,pending:any;
 try{
  for(const f of (await readdir('database/migrations')).filter(n=>n.endsWith('.sql')).sort())await db.query(await readFile(`database/migrations/${f}`,'utf8'));
  const category=(await db.query("INSERT INTO taxonomy_terms(dimension,code,name) VALUES('一级分类','TEST','测试分类') RETURNING id")).rows[0].id;
  for(let i=1;i<=12;i++)await db.query("INSERT INTO places(code,name,place_type,category_id,public_level,current_status,region) VALUES($1,$2,'主地点',$3,$4,$5,'测试区域')",[`WY-${String(i).padStart(4,'0')}`,`测试地点 ${i}`,category,i<=5?`P${i}`:'P1',i===7?'临时关闭':i===8?'待核实':'正常']);
  await db.query("UPDATE places SET parent_place_id=(SELECT id FROM places WHERE code='WY-0001') WHERE code='WY-0002'");
  await t.test('七种来源均可无 source_file 创建 pending，精度未知不伪造',async()=>{
   for(const source of ['manual_input','map_click','phone_gps','dji_srt','gps_track','imported_file','other']){
    const r=await add('WY-0001',{source_type:source,...(source==='phone_gps'?{coordinate_system:'WGS84',accuracy_meters:8.7}:{})});
    assert.equal(r.status,'pending');assert.equal(r.human_confirmed,false);assert.equal(r.source_file,null);assert.equal(r.source_type,source);assert(r.created_at);assert.equal(r.confirmed_at,null);if(source!=='phone_gps')assert(r.accuracy_note);
   }
   assert.equal((await db.query('SELECT count(*)::int n FROM place_coordinates')).rows[0].n,0);
  });
  await t.test('错误坐标、伪造确认、缺精度字段、错误日期、手机/地图坐标系矛盾拒绝',async()=>{
   for(const extra of [{latitude:91},{longitude:181},{accuracy_meters:-1},{source_type:'fake'},{source_time:'2026-02-30T00:00:00Z'},{human_confirmed:true},{status:'confirmed'},{source_type:'phone_gps',coordinate_system:'GCJ-02',accuracy_meters:3},{source_type:'phone_gps',coordinate_system:'WGS84',accuracy_meters:null},{source_type:'map_click',coordinate_system:'WGS84'}])assert.equal((await post('/api/admin/places/WY-0001/coordinate-candidates',{...basic,...extra})).statusCode,400);
   const {accuracy_meters,...missing}=basic;assert.equal((await post('/api/admin/places/WY-0001/coordinate-candidates',missing)).statusCode,400);
  });
  await t.test('数据库拒绝无限审核时间及非有限精度',async()=>{
   const p=(await db.query("SELECT id FROM places WHERE code='WY-0001'")).rows[0].id;
   for(const [precision,reviewed] of [['NaN',null],['Infinity',null],['1','infinity']]){
    await assert.rejects(db.query("INSERT INTO coordinate_candidates(code,matched_place_id,source_type,raw_latitude,raw_longitude,raw_coordinate_system,accuracy_meters,reviewed_at) VALUES($1,$2,'manual_input',27,117,'GCJ-02',$3,$4)",['INVALID-'+randomUUID(),p,precision,reviewed]));
   }
  });
  await t.test('内部坐标接口无需认证，仍校验业务参数',async()=>{
   for(const path of ['/api/admin/map-config','/api/admin/map-places'])assert.equal((await app.inject({url:path})).statusCode,200);
   const result=await post('/api/admin/places/WY-0001/coordinate-candidates',{...basic,latitude:91});assert.equal(result.statusCode,400);
  });
  await t.test('人工确认 pending 并保留原始值、来源和人工确认时间',async()=>{
   pending=await add('WY-0001',{source_type:'phone_gps',coordinate_system:'WGS84',accuracy_meters:4.2,source_reference:'browser measurement'});
   const noAck=await post(`/api/admin/places/WY-0001/coordinate-candidates/${pending.id}/confirm`,{expected_current_id:null,acknowledged:false});assert.equal(noAck.statusCode,400);
   const r=await confirm('WY-0001',pending.id);assert.equal(r.statusCode,200,r.body);first=r.json();assert.equal(first.status,'active');assert.equal(first.raw_latitude,27.76);assert.equal(Number(first.accuracy_meters),4.2);assert.equal(first.source_type,'phone_gps');assert.equal(first.candidate_id,pending.id);assert(first.confirmed_at);assert.equal(first.confirmed_by,'owner');
  });
  await t.test('新坐标替换：原记录 superseded，数据不变且可追溯',async()=>{
   const c=await add('WY-0001',{latitude:27.77});const r=await confirm('WY-0001',c.id,first.id);assert.equal(r.statusCode,200,r.body);second=r.json();
   const old=(await db.query('SELECT * FROM place_coordinates WHERE id=$1',[first.id])).rows[0];assert.equal(old.status,'superseded');assert.equal(old.raw_latitude,first.raw_latitude);assert.equal(old.superseded_by,second.id);
   assert.equal((await db.query("SELECT count(*)::int n FROM place_coordinates WHERE place_id=$1 AND status='active'",[second.place_id])).rows[0].n,1);
   assert.equal((await app.inject({url:'/api/places/WY-0001'})).json().latitude,27.77);
  });
  await t.test('已替换候选再次确认返回冲突，不误报正式坐标成功',async()=>{const r=await confirm('WY-0001',pending.id,null);assert.equal(r.statusCode,409);assert.equal((await db.query('SELECT count(*)::int n FROM place_coordinates WHERE place_id=$1',[first.place_id])).rows[0].n,2);});
  await t.test('并发确认防覆盖：仅一条成功，另一条仍 pending',async()=>{
   const a=await add('WY-0009'),b=await add('WY-0009',{latitude:27.79});const r=await Promise.all([confirm('WY-0009',a.id),confirm('WY-0009',b.id)]);assert.deepEqual(r.map(x=>x.statusCode).sort(),[200,409]);
   assert.equal((await db.query("SELECT count(*)::int n FROM coordinate_candidates WHERE id IN ($1,$2) AND status='pending'",[a.id,b.id])).rows[0].n,1);
  });
  await t.test('拒绝需原因，拒绝后不可确认，跨地点候选不可确认',async()=>{
   const c=await add('WY-0010');assert.equal((await post(`/api/admin/places/WY-0010/coordinate-candidates/${c.id}/reject`,{reason:' '})).statusCode,400);
   assert.equal((await post(`/api/admin/places/WY-0010/coordinate-candidates/${c.id}/reject`,{reason:'落点错误'})).json().status,'rejected');assert.equal((await confirm('WY-0010',c.id)).statusCode,409);assert.equal((await confirm('WY-0001',c.id)).statusCode,404);
  });
  await t.test('未知坐标系仅能留候选，不可正式确认',async()=>{const c=await add('WY-0011',{coordinate_system:'未知'});assert.equal(c.converted_latitude,null);assert.equal((await confirm('WY-0011',c.id)).statusCode,422);});
  await t.test('数据库强制候选先行、载荷不可更改、禁止历史删除及复活',async()=>{
   await assert.rejects(db.query('UPDATE place_coordinates SET raw_latitude=20 WHERE id=$1',[first.id]),/immutable/);
   await assert.rejects(db.query('DELETE FROM place_coordinates WHERE id=$1',[first.id]),/cannot be deleted/);
   await assert.rejects(db.query("UPDATE place_coordinates SET status='active' WHERE id=$1",[first.id]),/Invalid formal/);
   await assert.rejects(db.query('DELETE FROM coordinate_candidates WHERE id=$1',[pending.id]),/cannot be deleted/);
   const c=await add('WY-0012');await assert.rejects(db.query('UPDATE coordinate_candidates SET raw_latitude=20 WHERE id=$1',[c.id]),/transition|immutable/);
   await assert.rejects(db.query("UPDATE coordinate_candidates SET status='confirmed',human_confirmed=true,confirmed_at=now(),confirmed_by='owner' WHERE id=$1",[c.id]),/commit together/);
  });
  await t.test('P2—P5、待核实、临时关闭和未确认通过真实公开接口保护',async()=>{
   for(const code of ['WY-0002','WY-0003','WY-0004','WY-0005','WY-0007','WY-0008']){const c=await add(code);assert.equal((await confirm(code,c.id)).statusCode,200);const r=await app.inject({url:`/api/places/${code}`});if(code==='WY-0005')assert.equal(r.statusCode,404);else{assert.equal(r.json().latitude,null);assert.equal(r.json().longitude,null);assert(!r.body.includes('raw_latitude'));}}
   await add('WY-0006');assert.equal((await app.inject({url:'/api/places/WY-0006'})).json().latitude,null);
  });
  await t.test('内部地图只读取 active，筛选和祖先链正确，保留后台 P5',async()=>{
   const all=(await app.inject({url:'/api/admin/map-places'})).json().items;assert(all.every((p:any)=>p.coordinate_status==='active'));assert(all.some((p:any)=>p.public_level==='P5'));assert(!all.some((p:any)=>p.code==='WY-0006'));
   assert.deepEqual(all.find((p:any)=>p.code==='WY-0002').ancestor_codes,['WY-0001']);
   const filtered=(await app.inject({url:'/api/admin/map-places?public_level=P2&region='+encodeURIComponent('测试区域')+'&category='+encodeURIComponent('测试分类')})).json().items;assert.equal(filtered.length,1);assert.equal(filtered[0].code,'WY-0002');
   assert.deepEqual((await app.inject({url:'/api/admin/map-places?coordinate_status=revoked'})).json().items,[]);
  });
  await t.test('撤销 active 后不恢复旧历史，地图与公开接口同步隐藏',async()=>{
   const r=await post(`/api/admin/places/WY-0001/coordinates/${second.id}/revoke`,{reason:'现场复核发现落点不准'});assert.equal(r.statusCode,200,r.body);assert.equal(r.json().status,'revoked');
   assert.equal((await app.inject({url:'/api/places/WY-0001'})).json().latitude,null);assert(!(await app.inject({url:'/api/admin/map-places'})).json().items.some((p:any)=>p.code==='WY-0001'));
   assert.equal((await db.query('SELECT status FROM place_coordinates WHERE id=$1',[first.id])).rows[0].status,'superseded');
   assert.equal((await checkDatabase(db)).passed,true);
  });
  await writeFile('reports/phase2/lifecycle-checks.json',JSON.stringify(await checkDatabase(db),null,2));
 }finally{await app.close();await db.end();await admin.query(`DROP DATABASE ${name} WITH (FORCE)`);await admin.end();}
});
