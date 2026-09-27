import 'dotenv/config';
import {test} from 'node:test';import assert from 'node:assert/strict';import pg from 'pg';import {randomUUID} from 'node:crypto';import {readFile,readdir} from 'node:fs/promises';
import {createApp} from '../../backend/src/app.js';
test('第二阶段卫星判点、独立确定度与连续处理',async t=>{
 const admin=new pg.Pool({connectionString:process.env.DATABASE_URL}),name=`wymap_test_${randomUUID().replaceAll('-','')}`;
 await admin.query(`CREATE DATABASE ${name}`);const url=new URL(process.env.DATABASE_URL!);url.pathname='/'+name;
 const db=new pg.Pool({connectionString:url.toString()}),app=createApp(db);
 const post=(url:string,payload:any)=>app.inject({method:'POST',url,payload});
 const input={latitude:27.76,longitude:117.99,coordinate_system:'GCJ-02',accuracy_meters:null,source_type:'map_click',source_reference:'腾讯卫星影像人工判读',position_certainty:'certain',source_time:'2026-09-08T08:00:00Z'};
 const add=async(code:string,extra={})=>{const r=await post(`/api/admin/places/${code}/coordinate-candidates`,{...input,...extra});assert.equal(r.statusCode,201,r.body);return r.json();};
 const confirm=async(code:string,c:any,previous:string|null=null)=>{const r=await post(`/api/admin/places/${code}/coordinate-candidates/${c.id}/confirm`,{expected_current_id:previous,acknowledged:true});assert.equal(r.statusCode,200,r.body);return r.json();};
 const queue=async(after='')=>(await app.inject({url:'/api/admin/coordinate-queue'+(after?'?after='+after:'')})).json();
 let candidate:any,formal:any,replacement:any;
 try{
  for(const f of (await readdir('database/migrations')).filter(n=>n.endsWith('.sql')).sort())await db.query(await readFile(`database/migrations/${f}`,'utf8'));
  const cat=(await db.query("INSERT INTO taxonomy_terms(dimension,code,name) VALUES('一级分类','TEST','测试') RETURNING id")).rows[0].id;
  for(let i=1;i<=5;i++)await db.query("INSERT INTO places(code,name,place_type,category_id,public_level,current_status) VALUES($1,$2,'主地点',$3,$4,'正常')",[`WY-000${i}`,`卫星测试${i}`,cat,`P${i}`]);
  await db.query("UPDATE places SET corridor_order=substring(code from 4)::int*100");
  await t.test('卫星候选记录准确来源、GCJ-02和确定度；未确认不可公开',async()=>{
   candidate=await add('WY-0001');assert.equal(candidate.source_reference,input.source_reference);assert.equal(candidate.source_type,'map_click');assert.equal(candidate.raw_coordinate_system,'GCJ-02');assert.equal(candidate.position_certainty,'certain');assert.equal(candidate.confidence_level,'C');assert.equal(candidate.accuracy_meters,null);assert.equal(candidate.status,'pending');assert.equal(candidate.human_confirmed,false);
   assert.equal((await app.inject({url:'/api/places/WY-0001'})).json().latitude,null);
   assert.equal((await db.query('SELECT count(*)::int n FROM place_coordinates')).rows[0].n,0);
  });
  await t.test('连续队列包括待确认与缺坐标，按路线顺序前进并绕回；筛选同义',async()=>{
   assert.equal((await queue()).remaining,5);assert.equal((await queue()).next.code,'WY-0001');assert.equal((await queue()).next.has_pending,true);
   assert.equal((await queue('WY-0001')).next.code,'WY-0002');assert.equal((await queue('WY-0005')).next.code,'WY-0001');
   const r=await app.inject({url:'/api/admin/places?coordinate='+encodeURIComponent('无正式坐标')});assert.equal(r.json().total,5);
   assert.equal((await app.inject({url:'/api/admin/coordinate-queue?after=bad'})).statusCode,400);
  });
  await t.test('位置确定度非法枚举拒绝；旧客户端可不填，不从来源推断',async()=>{
   assert.equal((await post('/api/admin/places/WY-0001/coordinate-candidates',{...input,position_certainty:'verified'})).statusCode,400);
   const {position_certainty,...legacy}=input;const r=await post('/api/admin/places/WY-0001/coordinate-candidates',legacy);assert.equal(r.statusCode,201);assert.equal(r.json().position_certainty,null);
  });
  await t.test('卫星人工确认可成为 active，确定度保留而核验表和日期不变',async()=>{
   formal=await confirm('WY-0001',candidate);assert.equal(formal.status,'active');assert.equal(formal.position_certainty,'certain');assert.equal(formal.source_reference,input.source_reference);assert.equal(formal.confidence_level,'C');
   const detail=(await app.inject({url:'/api/admin/places/WY-0001'})).json();assert.deepEqual(detail.verifications,[]);assert.equal(detail.last_verified_at,null);assert.equal(detail.latest_verification,null);
   assert.equal((await queue()).remaining,4);assert.equal((await queue()).next.code,'WY-0002');
  });
  await t.test('卫星替换保留旧位置确定度；候选和正式确定度不可改写',async()=>{
   const newer=await add('WY-0001',{latitude:27.78,position_certainty:'approximate'});replacement=await confirm('WY-0001',newer,formal.id);
   const old=(await db.query('SELECT * FROM place_coordinates WHERE id=$1',[formal.id])).rows[0];assert.equal(old.status,'superseded');assert.equal(old.position_certainty,'certain');assert.equal(old.raw_latitude,27.76);assert.equal(old.superseded_by,replacement.id);assert.equal(replacement.position_certainty,'approximate');
   await assert.rejects(db.query("UPDATE place_coordinates SET position_certainty='uncertain' WHERE id=$1",[formal.id]),/immutable/);
   await assert.rejects(db.query("UPDATE coordinate_candidates SET position_certainty='uncertain' WHERE id=$1",[newer.id]),/transition|reviewed|immutable/);
  });
  await t.test('卫星正式 P2—P5 内部可见而公开无精确坐标',async()=>{
   for(let i=2;i<=5;i++){
    const code=`WY-000${i}`;await confirm(code,await add(code));const r=await app.inject({url:`/api/places/${code}`});
    if(i===5)assert.equal(r.statusCode,404);else{assert.equal(r.json().latitude,null);assert.equal(r.json().longitude,null);assert(!r.body.includes('position_certainty'));assert(!r.body.includes(input.source_reference));}
   }
   const internal=(await app.inject({url:'/api/admin/map-places'})).json().items;assert.equal(internal.length,5);assert(internal.every((p:any)=>p.latitude!==null));assert.equal((await queue()).remaining,0);assert.equal((await queue()).next,null);
  });
  await t.test('撤销重回待处理队列；已有旧历史不复活；全部操作零实地核验',async()=>{
   const r=await post(`/api/admin/places/WY-0001/coordinates/${replacement.id}/revoke`,{reason:'判读需复查'});assert.equal(r.statusCode,200);
   assert.equal((await queue()).remaining,1);assert.equal((await queue()).next.code,'WY-0001');assert.equal((await queue('WY-0001')).next,null);
   assert.equal((await db.query('SELECT status FROM place_coordinates WHERE id=$1',[formal.id])).rows[0].status,'superseded');
   assert.equal((await db.query('SELECT count(*)::int n FROM verifications')).rows[0].n,0);
  });
  await t.test('地点已有实地核验时，卫星确认不改写既有核验与日期',async()=>{
   const prior=(await db.query("INSERT INTO verifications(code,place_id,verified_at,verifier,general_note) SELECT 'V-TEST-1',id,'2026-09-01T08:00:00Z','测试核验人','独立实地核验' FROM places WHERE code='WY-0001' RETURNING *")).rows[0];
   await confirm('WY-0001',await add('WY-0001'));
   assert.deepEqual((await db.query('SELECT * FROM verifications')).rows,[prior]);
   const detail=(await app.inject({url:'/api/admin/places/WY-0001'})).json();assert.equal(detail.last_verified_at,prior.verified_at.toISOString());assert.equal(detail.verifications.length,1);
  });
 }finally{await app.close();await db.end();await admin.query(`DROP DATABASE ${name} WITH (FORCE)`);await admin.end();}
});
