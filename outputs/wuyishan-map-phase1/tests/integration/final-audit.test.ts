import 'dotenv/config';
import {test} from 'node:test';import assert from 'node:assert/strict';import pg from 'pg';import {randomUUID} from 'node:crypto';import {readFile,readdir,writeFile} from 'node:fs/promises';
import {createApp} from '../../backend/src/app.js';import {addCandidate,confirmCandidate} from '../../backend/src/coordinates.js';import {snapshot,validateRows,type ImportRow} from '../../backend/src/importer.js';

test('最终独立审查：并发、旁路与故障注入',async t=>{
 const admin=new pg.Pool({connectionString:process.env.DATABASE_URL}),name='wymap_audit_'+randomUUID().replaceAll('-','');
 await admin.query('CREATE DATABASE '+name);const url=new URL(process.env.DATABASE_URL!);url.pathname='/'+name;assert.notEqual(url.pathname,new URL(process.env.DATABASE_URL!).pathname);
 const db=new pg.Pool({connectionString:url.toString()}),app=createApp(db),checks:string[]=[];
 const get=async(path:string)=>(await app.inject({url:path})).json();const post=(path:string,payload:any)=>app.inject({method:'POST',url:path,payload});
 const testCase=async(label:string,fn:()=>Promise<void>)=>t.test(label,async()=>{await fn();checks.push(label);});
 const detail=(code:string)=>get('/api/admin/places/'+code);
 const deletion=async(code:string)=>({expected_updated_at:(await detail(code)).updated_at,expected_children_token:(await get('/api/admin/places/'+code+'/delete-preview')).children_token,child_action:'detach'});
 const remove=async(code:string)=>post('/api/admin/places/'+code+'/delete',await deletion(code));
 const input={latitude:27.123456,longitude:117.123456,coordinate_system:'GCJ-02' as const,accuracy_meters:null,source_type:'map_click' as const,source_time:'2026-09-10T00:00:00Z'};
 let cat:string;
 const place=async(code:string,parent?:string)=>{await db.query("INSERT INTO places(code,name,place_type,category_id,parent_place_id,region,current_status) VALUES($1,$1,'主地点',$2,(SELECT id FROM places WHERE code=$3),'测试区','正常')",[code,cat,parent||null]);};
 const pid=async(code:string)=>(await db.query('SELECT id FROM places WHERE code=$1',[code])).rows[0].id;
 try{
  for(const f of (await readdir('database/migrations')).filter(n=>n.endsWith('.sql')).sort())await db.query(await readFile('database/migrations/'+f,'utf8'));
  cat=(await db.query("INSERT INTO taxonomy_terms(dimension,code,name) VALUES('一级分类','AUDIT','审查隔离数据') RETURNING id")).rows[0].id;
  for(let i=1;i<=20;i++)await place('WY-'+String(8000+i));
  await testCase('子地点预览过期：新增、删除、改名后拒绝删除父点，无副作用',async()=>{
   for(const change of ['add','rename','delete']){
    const old=await deletion('WY-8001');
    if(change==='add')await db.query('UPDATE places SET parent_place_id=$1 WHERE code=$2',[await pid('WY-8001'),'WY-8002']);
    if(change==='rename')await db.query("UPDATE places SET name='已更名的子地点' WHERE code='WY-8002'");
    if(change==='delete')assert.equal((await remove('WY-8002')).statusCode,200);
    const result=await post('/api/admin/places/WY-8001/delete',old);assert.equal(result.statusCode,409,result.body);assert.equal((await detail('WY-8001')).deleted_at,null);
   }
  });
  await testCase('自身、任意后代、已删除、duplicate 均不可成为转移目标',async()=>{
   await db.query('UPDATE places SET parent_place_id=$1 WHERE code=$2',[await pid('WY-8003'),'WY-8004']);
   await db.query('UPDATE places SET parent_place_id=$1 WHERE code=$2',[await pid('WY-8004'),'WY-8005']);
   await db.query('UPDATE places SET duplicate_of_place_id=$1 WHERE code=$2',[await pid('WY-8007'),'WY-8006']);
   for(const target of ['WY-8003','WY-8004','WY-8005','WY-8002','WY-8006']){
    const response=await post('/api/admin/places/WY-8003/delete',{...await deletion('WY-8003'),child_action:'transfer',new_parent_code:target});assert.equal(response.statusCode,409,response.body);
    assert.equal((await detail('WY-8004')).parent_code,'WY-8003');
   }
   await assert.rejects(db.query('UPDATE places SET duplicate_of_place_id=id WHERE code=$1',['WY-8007']));
   await assert.rejects(db.query('UPDATE places SET duplicate_of_place_id=$1 WHERE code=$2',[await pid('WY-8006'),'WY-8008']));
   await assert.rejects(db.query('UPDATE places SET parent_place_id=$1 WHERE code=$2',[await pid('WY-8005'),'WY-8003']));
  });
  await testCase('带坐标、名称历史、攻略、路线、媒体和核验的子点转移，仅父级和更新时间变化；恢复不抢回',async()=>{
   const id=await pid('WY-8017');await db.query('UPDATE places SET parent_place_id=$1,corridor_order=500 WHERE id=$2',[await pid('WY-8016'),id]);
   const c=await addCandidate(db,'WY-8017',input);await confirmCandidate(db,'WY-8017',c.id,null);
   await db.query("UPDATE places SET name='关联完整的子地点' WHERE id=$1",[id]);
   const r=(await db.query("INSERT INTO routes(code,name,route_type) VALUES('R-8801','审查测试路线','候选路线') RETURNING id")).rows[0].id;await db.query('INSERT INTO route_stops(route_id,place_id,sequence) VALUES($1,$2,1)',[r,id]);
   const g=(await db.query("INSERT INTO guides(code,title,guide_type) VALUES('G-8801','审查测试攻略','路线/专题') RETURNING id")).rows[0].id;await db.query('INSERT INTO guide_places(guide_id,place_id) VALUES($1,$2)',[g,id]);
   const m=(await db.query("INSERT INTO media(place_id,media_type,local_source_path) VALUES($1,'文件','isolated-test.txt') RETURNING id",[id])).rows[0].id;
   const v=(await db.query("INSERT INTO verifications(code,place_id,verified_at,verifier) VALUES('V-AUDIT',$1,now(),'isolated fixture') RETURNING id",[id])).rows[0].id;await db.query('INSERT INTO verification_media(verification_id,media_id) VALUES($1,$2)',[v,m]);
   const tables=['place_coordinates','coordinate_candidates','place_name_history','routes','route_stops','guide_places','guides','media','verifications','verification_media'];const before:Record<string,any>={};
   for(const table of tables)before[table]=(await db.query('SELECT * FROM '+table)).rows;
   const old=(await db.query('SELECT * FROM places WHERE id=$1',[id])).rows[0];
   const response=await post('/api/admin/places/WY-8016/delete',{...await deletion('WY-8016'),child_action:'transfer',new_parent_code:'WY-8018'});assert.equal(response.statusCode,200,response.body);
   assert.equal((await post('/api/admin/places/WY-8016/restore',{expected_deleted_at:response.json().deleted_at})).statusCode,200);
   const after=(await db.query('SELECT * FROM places WHERE id=$1',[id])).rows[0];for(const key of Object.keys(old))if(!['parent_place_id','updated_at'].includes(key))assert.deepEqual(after[key],old[key],key);assert.equal(after.parent_place_id,await pid('WY-8018'));
   for(const table of tables)assert.deepEqual((await db.query('SELECT * FROM '+table)).rows,before[table],table);
  });
  await testCase('子点解绑或转移已完成后父点删除失败：全表逐行回滚',async()=>{
   for(const child_action of ['detach','transfer']){
    const before=(await db.query('SELECT * FROM places ORDER BY code')).rows;
    await db.query('CREATE SEQUENCE audit_rollback_signal');
    await db.query("CREATE FUNCTION fail_parent_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.code='WY-8003' AND NEW.deleted_at IS NOT NULL THEN IF EXISTS(SELECT 1 FROM places WHERE code='WY-8004' AND parent_place_id=NEW.id) THEN RAISE EXCEPTION 'child was not processed'; END IF; PERFORM setval('audit_rollback_signal',42); RAISE EXCEPTION 'audit failure after child processed'; END IF; RETURN NEW; END $$");
    await db.query('CREATE TRIGGER audit_fail BEFORE UPDATE OF deleted_at ON places FOR EACH ROW EXECUTE FUNCTION fail_parent_delete()');
    const result=await post('/api/admin/places/WY-8003/delete',{...await deletion('WY-8003'),child_action,new_parent_code:'WY-8007'});assert.equal(result.statusCode,500);
    assert.equal(Number((await db.query('SELECT last_value FROM audit_rollback_signal')).rows[0].last_value),42);
    assert.deepEqual((await db.query('SELECT * FROM places ORDER BY code')).rows,before);
    await db.query('DROP TRIGGER audit_fail ON places');await db.query('DROP FUNCTION fail_parent_delete()');await db.query('DROP SEQUENCE audit_rollback_signal');
   }
  });
  await testCase('创建候选等待地点锁，删除先提交时返回404，不能写入回收站',async()=>{
   const lock=await db.connect();await lock.query('BEGIN');await lock.query("SELECT 1 FROM places WHERE code='WY-8009' FOR UPDATE");
   const creating=addCandidate(db,'WY-8009',input).then(()=>({ok:true}),e=>({ok:false,status:e.statusCode}));
   try{
    const deadline=Date.now()+5000;let waiting=false;
    while(Date.now()<deadline){waiting=!!(await admin.query("SELECT 1 FROM pg_stat_activity WHERE datname=$1 AND wait_event_type='Lock'",[name])).rowCount;if(waiting)break;await new Promise(r=>setTimeout(r,20));}assert(waiting);
    await lock.query("UPDATE places SET deleted_at=now(),deleted_by='audit',deletion_reason='isolated race' WHERE code='WY-8009'");await lock.query('COMMIT');
    assert.deepEqual(await creating,{ok:false,status:404});assert.equal((await db.query('SELECT count(*)::int n FROM coordinate_candidates WHERE matched_place_id=$1',[await pid('WY-8009')])).rows[0].n,0);
   }finally{await lock.query('ROLLBACK');lock.release();}
  });
  await testCase('确认幂等仅限仍active；历史重试返回409，原始历史禁止UPDATE/DELETE',async()=>{
   const a=await addCandidate(db,'WY-8010',input),formal=await confirmCandidate(db,'WY-8010',a.id,null);
   assert.equal((await confirmCandidate(db,'WY-8010',a.id,null)).id,formal.id);
   const b=await addCandidate(db,'WY-8010',{...input,latitude:28});const newer=await confirmCandidate(db,'WY-8010',b.id,formal.id);
   await assert.rejects(confirmCandidate(db,'WY-8010',a.id,null),(e:any)=>e.statusCode===409);
   for(const sql of ["UPDATE place_coordinates SET raw_latitude=1 WHERE id=$1","DELETE FROM place_coordinates WHERE id=$1","UPDATE place_coordinates SET status='active' WHERE id=$1"]){await assert.rejects(db.query(sql,[formal.id]));}
   const stale=await post('/api/admin/places/WY-8010/location/delete',{expected_current_id:formal.id});assert.equal(stale.statusCode,409);assert.equal((await detail('WY-8010')).coordinates.find((c:any)=>c.status==='active').id,newer.id);
  });
  await testCase('旧候选属于duplicate后不能正式确认，导入拒绝删除/duplicate新引用但编号仍保留',async()=>{
   const c=await addCandidate(db,'WY-8011',input);await db.query('UPDATE places SET duplicate_of_place_id=$1 WHERE code=$2',[await pid('WY-8012'),'WY-8011']);
   await assert.rejects(confirmCandidate(db,'WY-8011',c.id,null),(e:any)=>e.statusCode===404);
   const s=await snapshot(db);assert(Object.hasOwn(s.places,'WY-8002'));assert(Object.hasOwn(s.places,'WY-8011'));
   for(const target of ['WY-8002','WY-8011'])for(const sheet of ['路线库','坐标候选匹配','地点库']){
    const row:ImportRow={sheet,row:2,code:'WY-9999',raw:{},data:{parent_code:target,stops:[target],matched_code:target,category:'审查隔离数据',route_codes:[],guide_codes:[]},issues:[],action:'insert'};
    validateRows([row],s);assert.equal(row.action,'error');assert(row.issues.some(i=>i.message.includes('已删除地点或重复档案')));
   }
  });
  await testCase('全部公开等级×全部开放状态：仅正常P1 active可带坐标；其余精确字段均隔离',async()=>{
   const c=await addCandidate(db,'WY-8013',input);await confirmCandidate(db,'WY-8013',c.id,null);
   const statuses=(await db.query("SELECT unnest(enum_range(NULL::place_status))::text status")).rows;
   for(const level of ['P1','P2','P3','P4','P5'])for(const {status} of statuses){
    await db.query('UPDATE places SET public_level=$1,current_status=$2 WHERE code=$3',[level,status,'WY-8013']);
    const r=await app.inject({url:'/api/places/WY-8013'});
    if(level==='P5'){assert.equal(r.statusCode,404);continue;}
    const p=r.json();assert.deepEqual(Object.keys(p).sort(),['code','name','current_status','public_level','region','latitude','longitude','coordinate_system'].sort());
    if(level==='P1'&&status==='正常')assert.equal(p.latitude,input.latitude);else{assert.equal(p.latitude,null);assert.equal(p.longitude,null);assert.equal(p.coordinate_system,null);}
    const list=(await get('/api/places')).items.find((p:any)=>p.code==='WY-8013');assert.deepEqual(list,p);
   }
  });
  await testCase('相同旧名称并发改名一胜一冲突，历史不可篡改；同一旧排序并发调整一胜一冲突',async()=>{
   const renamed=await Promise.all(['甲','乙'].map(name=>post('/api/admin/places/WY-8014/name',{name,expected_name:'WY-8014'})));assert.deepEqual(renamed.map(r=>r.statusCode).sort(),[200,409]);
   assert.equal((await db.query('SELECT count(*)::int n FROM place_name_history WHERE place_id=$1',[await pid('WY-8014')])).rows[0].n,1);
   await assert.rejects(db.query("UPDATE place_name_history SET old_name='changed' WHERE place_id=$1",[await pid('WY-8014')]));
   await assert.rejects(db.query('DELETE FROM place_name_history WHERE place_id=$1',[await pid('WY-8014')]));
   const moved=await Promise.all([100,200].map(order=>post('/api/admin/places/WY-8015/corridor-order',{order,expected_order:null})));assert.deepEqual(moved.map(r=>r.statusCode).sort(),[200,409]);
  });
  await writeFile('reports/phase2/final-audit/focused-checks.json',JSON.stringify({passed:checks.length===9,database:name,checks,at:new Date().toISOString()},null,2));
 }finally{await app.close();await db.end();assert.match(name,/^wymap_audit_[a-f0-9]{32}$/);await admin.query('DROP DATABASE '+name+' WITH (FORCE)');await admin.end();}
});
