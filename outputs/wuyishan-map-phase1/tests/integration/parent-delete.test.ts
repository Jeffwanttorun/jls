import 'dotenv/config';import {test} from 'node:test';import assert from 'node:assert/strict';import pg from 'pg';import {randomUUID} from 'node:crypto';import {readFile,readdir} from 'node:fs/promises';import {createApp} from '../../backend/src/app.js';

test('父地点删除时处理子地点：独立 PostgreSQL 数据库回归',async t=>{
 const admin=new pg.Pool({connectionString:process.env.DATABASE_URL}),name='wymap_parent_delete_'+randomUUID().replaceAll('-','');await admin.query('CREATE DATABASE '+name);const url=new URL(process.env.DATABASE_URL!);url.pathname='/'+name;const db=new pg.Pool({connectionString:url.toString()}),app=createApp(db);
 const post=(path:string,payload:any)=>app.inject({method:'POST',url:path,payload}),get=(path:string)=>app.inject({url:path});
 const updated=async(code:string)=>new Date((await db.query('SELECT updated_at FROM places WHERE code=$1',[code])).rows[0].updated_at).toISOString();
 const remove=async(code:string,child_action:'detach'|'transfer'='detach',new_parent_code?:string)=>post('/api/admin/places/'+code+'/delete',{expected_updated_at:await updated(code),expected_children_token:(await get('/api/admin/places/'+code+'/delete-preview')).json().children_token,child_action,new_parent_code:new_parent_code||null});
 const restore=async(code:string)=>{const value=(await db.query('SELECT deleted_at FROM places WHERE code=$1',[code])).rows[0].deleted_at;return post('/api/admin/places/'+code+'/restore',{expected_deleted_at:new Date(value).toISOString()});};
 try{
  for(const f of (await readdir('database/migrations')).filter(n=>n.endsWith('.sql')).sort())await db.query(await readFile('database/migrations/'+f,'utf8'));
  const category=(await db.query("INSERT INTO taxonomy_terms(dimension,code,name) VALUES('一级分类','PARENT_DELETE','父级删除测试') RETURNING id")).rows[0].id;
  const rows=[
   ['WY-9100','单子父点',null],['WY-9101','单个子点','WY-9100'],
   ['WY-9200','多子父点',null],['WY-9201','多子点一','WY-9200'],['WY-9202','多子点二','WY-9200'],
   ['WY-9300','转移父点',null],['WY-93025','转移子点一','WY-9300'],['WY-93026','转移子点二','WY-9300'],['WY-9399','新父地点',null],
   ['WY-9400','事务父点',null],['WY-9401','事务子点一','WY-9400'],['WY-9402','事务子点二','WY-9400'],
   ['WY-9500','循环根节点',null],['WY-9501','循环子节点','WY-9500'],['WY-9502','循环孙节点','WY-9501'],
   ['WY-9600','无子地点',null]
  ] as const;
  for(const [code,label] of rows)await db.query("INSERT INTO places(code,name,place_type,category_id,public_level,current_status) VALUES($1,$2,'主地点',$3,'P2','正常')",[code,label,category]);
  for(const [code,,parent] of rows)if(parent)await db.query('UPDATE places SET parent_place_id=(SELECT id FROM places WHERE code=$1) WHERE code=$2',[parent,code]);
  const id=async(code:string)=>(await db.query('SELECT id FROM places WHERE code=$1',[code])).rows[0].id;

  await t.test('无子地点直接进入回收站',async()=>{
   const before=(await db.query("SELECT id,code,corridor_order FROM places WHERE code='WY-9600'")).rows[0],r=await remove('WY-9600');assert.equal(r.statusCode,200,r.body);assert((await db.query("SELECT deleted_at FROM places WHERE code='WY-9600'")).rows[0].deleted_at);assert.deepEqual((await db.query("SELECT id,code,corridor_order FROM places WHERE code='WY-9600'")).rows[0],before);
  });
  await t.test('一个子地点默认解除父级，恢复父地点后不自动抢回',async()=>{
   const childBefore=(await db.query("SELECT * FROM places WHERE code='WY-9101'")).rows[0],r=await remove('WY-9100');assert.equal(r.statusCode,200,r.body);const child=(await db.query("SELECT * FROM places WHERE code='WY-9101'")).rows[0];assert.equal(child.parent_place_id,null);
   for(const key of ['id','code','name','corridor_order','public_level','current_status'])assert.deepEqual(child[key],childBefore[key],key);
   assert.equal((await restore('WY-9100')).statusCode,200);assert.equal((await db.query("SELECT parent_place_id FROM places WHERE code='WY-9101'")).rows[0].parent_place_id,null);
  });
  await t.test('多个直接子地点一次全部解除父级',async()=>{
   const r=await remove('WY-9200');assert.equal(r.statusCode,200,r.body);assert.deepEqual((await db.query("SELECT parent_place_id FROM places WHERE code IN ('WY-9201','WY-9202') ORDER BY code")).rows.map(x=>x.parent_place_id),[null,null]);
  });
  await t.test('多个子地点统一转移到合法的新父地点',async()=>{
   const preview=(await get('/api/admin/places/WY-9300/delete-preview')).json();assert.deepEqual(preview.children.map((x:any)=>x.code),['WY-93025','WY-93026']);assert(preview.parent_options.some((x:any)=>x.code==='WY-9399'));
   const r=await remove('WY-9300','transfer','WY-9399');assert.equal(r.statusCode,200,r.body);const target=await id('WY-9399');assert.deepEqual((await db.query("SELECT parent_place_id FROM places WHERE code IN ('WY-93025','WY-93026') ORDER BY code")).rows.map(x=>x.parent_place_id),[target,target]);
   assert.equal((await restore('WY-9300')).statusCode,200);assert.deepEqual((await db.query("SELECT parent_place_id FROM places WHERE code IN ('WY-93025','WY-93026') ORDER BY code")).rows.map(x=>x.parent_place_id),[target,target]);
  });
  await t.test('任一子地点更新失败时子地点处理和父地点删除全部回滚',async()=>{
   await db.query("CREATE FUNCTION reject_second_child() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD.code='WY-9402' AND NEW.parent_place_id IS DISTINCT FROM OLD.parent_place_id THEN RAISE EXCEPTION 'test child failure'; END IF; RETURN NEW; END $$");
   await db.query('CREATE TRIGGER reject_second_child_update BEFORE UPDATE OF parent_place_id ON places FOR EACH ROW EXECUTE FUNCTION reject_second_child()');
   const parent=await id('WY-9400'),historyBefore=Number((await db.query('SELECT count(*) n FROM place_recycle_history')).rows[0].n),r=await remove('WY-9400');assert.equal(r.statusCode,500);
   assert.equal((await db.query("SELECT deleted_at FROM places WHERE code='WY-9400'")).rows[0].deleted_at,null);assert.deepEqual((await db.query("SELECT parent_place_id FROM places WHERE code IN ('WY-9401','WY-9402') ORDER BY code")).rows.map(x=>x.parent_place_id),[parent,parent]);assert.equal(Number((await db.query('SELECT count(*) n FROM place_recycle_history')).rows[0].n),historyBefore);
   await db.query('DROP TRIGGER reject_second_child_update ON places');await db.query('DROP FUNCTION reject_second_child()');
  });
  await t.test('不能把子地点转移到当前父地点的后代',async()=>{
   const preview=(await get('/api/admin/places/WY-9500/delete-preview')).json();assert.equal(preview.parent_options.some((x:any)=>['WY-9500','WY-9501','WY-9502'].includes(x.code)),false);
   const r=await remove('WY-9500','transfer','WY-9502');assert.equal(r.statusCode,409);assert.match(r.json().error,/后代/);assert.equal((await db.query("SELECT deleted_at FROM places WHERE code='WY-9500'")).rows[0].deleted_at,null);assert.equal((await db.query("SELECT parent_place_id FROM places WHERE code='WY-9501'")).rows[0].parent_place_id,await id('WY-9500'));
  });
 }finally{await app.close();await db.end();await admin.query('DROP DATABASE '+name+' WITH (FORCE)');await admin.end();}
});
