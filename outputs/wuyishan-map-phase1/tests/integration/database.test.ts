import 'dotenv/config';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { readFile,readdir,mkdtemp,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import ExcelJS from 'exceljs';
import { createApp } from '../../backend/src/app.js';
import { preview,apply,snapshot,specs } from '../../backend/src/importer.js';
import { checkDatabase } from '../../backend/src/checks.js';
import {addCandidate,confirmCandidate} from '../../backend/src/coordinates.js';

test('真实 PostgreSQL/PostGIS 隔离数据库：导入、约束、接口与隐私回归',async t=>{
 const admin=new pg.Pool({connectionString:process.env.DATABASE_URL});
 const name=`wymap_test_${randomUUID().replaceAll('-','')}`;
 await admin.query(`CREATE DATABASE ${name}`);
 const url=new URL(process.env.DATABASE_URL!);url.pathname='/'+name;
 const db=new pg.Pool({connectionString:url.toString()});
 const app=createApp(db);
 try{
  for(const f of (await readdir('database/migrations')).filter(n=>n.endsWith('.sql')).sort())await db.query(await readFile(`database/migrations/${f}`,'utf8'));
  const source='sources/武夷山奶爸地图_主数据库_V1.2.xlsx';
  await t.test('预览零写入，迁移 93 行并保留 46 地点',async()=>{
   const p=await preview(source,await snapshot(db));assert.equal(Number((await db.query('SELECT count(*) n FROM places')).rows[0].n),0);
   const result=await apply(db,p,source);assert.deepEqual(result.counts,{success:93,failed:0,skipped:0,warnings:119,places:46});
   assert.equal(Number((await db.query('SELECT count(*) n FROM route_stops')).rows[0].n),14);
   assert.equal(Number((await db.query("SELECT count(*) n FROM route_stops s JOIN routes r ON r.id=s.route_id WHERE r.code='R-0004'")).rows[0].n),0);
  });
  await t.test('重复导入幂等，93 行跳过，地点名称不覆盖',async()=>{
   const p=await preview(source,await snapshot(db));const result=await apply(db,p,source);assert.equal(result.counts.skipped,93);assert.equal(result.counts.success,0);
   assert.equal(Number((await db.query('SELECT count(*) n FROM places')).rows[0].n),46);
  });
  await t.test('源文件或预览摘要变化拒绝导入',async()=>{const p=await preview(source,await snapshot(db));p.digest='tampered';await assert.rejects(apply(db,p,source),/预览已变化/);});
  await t.test('数据库外键、业务编号唯一及不可修改、枚举、循环约束',async()=>{
   const category=(await db.query("SELECT id FROM taxonomy_terms WHERE dimension='一级分类' LIMIT 1")).rows[0].id;
   await assert.rejects(db.query("INSERT INTO places(code,name,place_type,category_id) VALUES('WY-0001','重复','主地点',$1)",[category]),(e:any)=>e.code==='23505');
   await assert.rejects(db.query("UPDATE places SET code='WY-9999' WHERE code='WY-0001'"),/immutable/);
   await assert.rejects(db.query("UPDATE places SET public_level='P9' WHERE code='WY-0001'"),(e:any)=>e.code==='22P02');
   await assert.rejects(db.query("UPDATE places SET parent_place_id=$1 WHERE code='WY-0001'",[randomUUID()]),(e:any)=>e.code==='23503');
   await assert.rejects(db.query("UPDATE places SET parent_place_id=(SELECT id FROM places WHERE code='WY-0002') WHERE code='WY-0001'"),/Parent cycle/);
   await assert.rejects(db.query('INSERT INTO route_stops(route_id,place_id,sequence) VALUES($1,$2,1)',[randomUUID(),randomUUID()]),(e:any)=>e.code==='23503');
  });
  await t.test('内部列表、详情和筛选选项无需凭证即可访问',async()=>{
   for(const path of ['/api/admin/places','/api/admin/places/WY-0024','/api/admin/options'])assert.equal((await app.inject({url:path})).statusCode,200);
   assert.equal((await app.inject({url:'/api/admin/places',headers:{authorization:'Bearer wrong'}})).statusCode,200);
  });
  await t.test('列表搜索筛选、分页、详情父子及关联数据',async()=>{
   const list=await app.inject({url:'/api/admin/places?q=WY-0024'});assert.equal(list.statusCode,200);assert.equal(list.json().items[0].name,'桃源峪');assert.equal(list.json().total,1);
   const p2=await app.inject({url:'/api/admin/places?public_level=P2&coordinate=缺坐标'});assert(p2.json().items.every((p:any)=>p.public_level==='P2'));
   const detail=(await app.inject({url:'/api/admin/places/WY-0024'})).json();assert.equal(detail.children.length,3);assert(detail.routes.some((r:any)=>r.code==='R-0001'));assert(detail.guides.some((g:any)=>g.code==='G-0001'));
   assert.equal((await app.inject({url:'/api/admin/places?page_size=-1'})).statusCode,400);
   const injection=await app.inject({url:'/api/admin/places?q='+encodeURIComponent("' OR 1=1--")});assert.equal(injection.json().total,0);
  });
  await t.test('P1—P5 与未确认/关闭组合由真实 API 验证，不只验证空数据',async()=>{
   const cat=(await db.query("SELECT id FROM taxonomy_terms WHERE dimension='一级分类' LIMIT 1")).rows[0].id;
   for(let i=1;i<=8;i++){
    const level=i<=5?`P${i}`:'P1',code=`WY-99${String(i).padStart(2,'0')}`,status=i===7?'临时关闭':i===8?'待核实':'正常';
    const p=(await db.query('INSERT INTO places(code,name,place_type,category_id,public_level,current_status,region,notes) VALUES($1,$2,\'主地点\',$3,$4,$5,\'测试区域\',\'27.987654 private\') RETURNING id',[code,'隐私测试',cat,level,status])).rows[0].id;
    const confirmed=i!==6;
    const candidate=await addCandidate(db,code,{latitude:27.987654,longitude:117.987654,coordinate_system:'WGS84',source_type:'gps_track',source_reference:'private.gpx',source_time:'2026-09-05T00:00:00Z',accuracy_meters:5});
    if(confirmed)await confirmCandidate(db,code,candidate.id,null);
    const response=await app.inject({url:`/api/places/${code}`});
    if(i===5){assert.equal(response.statusCode,404);continue;}
    const body=response.json();assert.equal(response.statusCode,200);assert.equal(body.latitude!==null,i===1);assert.equal(body.longitude!==null,i===1);
    assert(!response.body.includes('private'));assert(!response.body.includes('27.987654'));if(i===4)assert.equal(body.region,null);
    const adminDetail=(await app.inject({url:`/api/admin/places/${code}`})).json();assert.equal(adminDetail.coordinates.length,confirmed?1:0);
   }
   const list=(await app.inject({url:'/api/places'})).json().items;assert(!list.some((p:any)=>p.public_level==='P5'));assert(list.filter((p:any)=>p.public_level!=='P1').every((p:any)=>p.latitude===null&&p.longitude===null));
   assert.equal((await checkDatabase(db)).passed,true);
  });
  await t.test('缺少确认审计凭证、无地图坐标系或坐标越界被数据库拒绝',async()=>{
   const p=(await db.query("SELECT id FROM places WHERE code='WY-0001'")).rows[0].id;
   const base="INSERT INTO place_coordinates(place_id,raw_latitude,raw_longitude,raw_coordinate_system,source_type,source_file,map_latitude,map_longitude,map_coordinate_system,human_confirmed,confirmed_at,confirmed_by) VALUES($1,$2,117,'WGS84','gps_track','a.gpx',27,117,$3,$4,$5,$6)";
   for(const args of [[27,'GCJ-02',true,'2026-09-05T00:00:00Z',null],[27,null,false,null,null],[100,'GCJ-02',false,null,null]])await assert.rejects(db.query(base,[p,...args]),/confirmed candidate/);
  });
  await t.test('核验历史新增不覆盖，错误日期被数据库拒绝',async()=>{
   const p=(await db.query("SELECT id FROM places WHERE code='WY-0001'")).rows[0].id;
   await db.query("INSERT INTO verifications(code,place_id,verified_at,verifier) VALUES('V-9001',$1,'2026-09-01T10:00:00+08:00','测试人'),('V-9002',$1,'2026-09-05T10:00:00+08:00','测试人')",[p]);
   await assert.rejects(db.query("UPDATE verifications SET verifier='改写' WHERE code='V-9001'"),/append-only/);
   await assert.rejects(db.query("DELETE FROM verifications WHERE code='V-9001'"),/append-only/);
   await assert.rejects(db.query("INSERT INTO verifications(code,place_id,verified_at,verifier) VALUES('V-9003',$1,'2026-02-30','测试人')",[p]));
   await assert.rejects(db.query("INSERT INTO verifications(code,place_id,verified_at,verifier) VALUES('V-9004',$1,'infinity','测试人')",[p]),(e:any)=>e.code==='23514');
   const d=(await app.inject({url:'/api/admin/places/WY-0001'})).json();assert.equal(d.verifications.length,2);assert.equal(d.latest_verification.code,'V-9002');
  });
  await t.test('错误样本 Excel：坏行隔离、子行先出现、候选导入、实地核验及数据库单行失败',async()=>{
   const work=resolve('../../work');const dir=await mkdtemp(resolve(work,'integration-'));const file=resolve(dir,'fixture.xlsx');
   const w=new ExcelJS.Workbook();
   const add=(sheet:string,rows:Record<string,unknown>[])=>{const ws=w.addWorksheet(sheet);ws.addRow(specs[sheet].headers);for(const r of rows)ws.addRow(specs[sheet].headers.map(k=>r[k]??null));};
   add('分类标签',[]);
   const defaults={'名称':'测试地点','点位层级':'主地点','一级分类':'展馆','公开等级':'P1','当前状态':'正常','优先级':'高'};
   add('地点库',[{...defaults,'地点ID':'WY-9802','上级地点ID':'WY-9801'},{...defaults,'地点ID':'WY-9801'},{...defaults,'地点ID':'WY-9803','名称':''},{...defaults,'地点ID':'WY-9804','上级地点ID':'WY-9899'},{...defaults,'地点ID':'WY-9805','名称':'触发数据库拒绝'},{...defaults,'地点ID':'WY-9806'}]);
   add('路线库',[{'路线ID':'R-9801','路线名称':'有效候选线','路线类型':'候选路线','状态':'待核实','地点序列（地点ID）':'WY-9801→WY-9802'},{'路线ID':'R-9802','路线名称':'坏引用','路线类型':'候选路线','状态':'待核实','地点序列（地点ID）':'WY-9899'}]);
   add('攻略库',[]);
   add('实地核验',[{'核验ID':'V-9801','地点ID':'WY-9801','核验日期':'2026-09-05 10:00','核验人':'测试核验员','开放状态':'正常','现场照片索引':'photo-001'}]);
   add('坐标候选匹配',[{'候选ID':'C-9801','源文件名':'DJI_001.SRT','源类型':'DJI','记录时间':'2026-09-05 09:30','原始纬度':27.8,'原始经度':117.8,'原始坐标系':'WGS84','目标地点ID':'WY-9801','匹配置信度':'高','匹配依据':'文件主题与现场记录一致','地图纬度':27.81,'地图经度':117.81,'地图坐标系':'GCJ-02','人工确认':'是','写回状态':'可写回'}]);
   await w.xlsx.writeFile(file);
   await db.query("ALTER TABLE places ADD CONSTRAINT test_row_rejection CHECK(name <> '触发数据库拒绝')");
   const p=await preview(file,await snapshot(db));assert.equal(p.summary.failed,3);
   const result=await apply(db,p,file);assert.equal(result.counts.failed,4);assert.equal(result.counts.places,3);
   assert.equal(Number((await db.query("SELECT count(*) n FROM places WHERE code IN ('WY-9801','WY-9802','WY-9806')")).rows[0].n),3);
   const candidate=(await db.query("SELECT * FROM coordinate_candidates WHERE code='C-9801'")).rows[0];assert.equal(candidate.human_confirmed,false);assert.equal(candidate.source_claimed_confirmed,true);assert.equal(candidate.source_file,'DJI_001.SRT');
   assert.equal((await app.inject({url:'/api/places/WY-9801'})).json().latitude,null);
   const details=(await app.inject({url:'/api/admin/places/WY-9801'})).json();assert.equal(details.latest_verification.code,'V-9801');assert.equal(details.children[0].code,'WY-9802');
   await writeFile('reports/phase2/error-fixture-result.json',JSON.stringify(result,null,2));
  });
 }finally{await app.close();await db.end();await admin.query(`DROP DATABASE ${name} WITH (FORCE)`);await admin.end();}
});
