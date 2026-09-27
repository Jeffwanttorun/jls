import 'dotenv/config';import {test} from 'node:test';import assert from 'node:assert/strict';import pg from 'pg';import {randomUUID} from 'node:crypto';import {readFile,readdir} from 'node:fs/promises';
test('从旧版本升级保留坐标载荷和原确认历史，只有最新有效',async()=>{
 const admin=new pg.Pool({connectionString:process.env.DATABASE_URL}),name=`wymap_test_${randomUUID().replaceAll('-','')}`;await admin.query(`CREATE DATABASE ${name}`);
 const url=new URL(process.env.DATABASE_URL!);url.pathname='/'+name;const db=new pg.Pool({connectionString:url.toString()});
 try{
  for(const f of ['001_initial.sql','002_integrity.sql'])await db.query(await readFile(`database/migrations/${f}`,'utf8'));
  const cat=(await db.query("INSERT INTO taxonomy_terms(dimension,code,name) VALUES('一级分类','TEST','测试') RETURNING id")).rows[0].id;
  const place=(await db.query("INSERT INTO places(code,name,place_type,category_id) VALUES('WY-0001','旧数据','主地点',$1) RETURNING id",[cat])).rows[0].id;
  const ids=[];for(let i=1;i<=3;i++){const c=(await db.query("INSERT INTO place_coordinates(place_id,raw_latitude,raw_longitude,raw_coordinate_system,source_type,source_file,map_latitude,map_longitude,map_coordinate_system,human_confirmed,confirmed_at,confirmed_by) VALUES($1,$2,117,'WGS84','GPS','old.gpx',$2,117,'GCJ-02',$3,$4,$5) RETURNING id",[place,27+i/100,i<3,i<3?`2026-09-0${i}T00:00:00Z`:null,i<3?'原核验人':null])).rows[0];ids.push(c.id);}
  await db.query(await readFile('database/migrations/003_coordinate_history.sql','utf8'));
  const all=(await db.query('SELECT * FROM place_coordinates ORDER BY raw_latitude')).rows;
  assert.deepEqual(all.map(r=>r.status),['superseded','active','revoked']);assert.deepEqual(all.map(r=>r.id),ids);assert.deepEqual(all.map(r=>r.raw_latitude),[27.01,27.02,27.03]);
  assert(all.every(r=>r.source_reference==='old.gpx'&&r.source_type==='gps_track'));assert.equal(all[0].superseded_by,ids[1]);assert.equal(all[1].confirmed_by,'原核验人');
  assert.equal((await db.query('SELECT count(*)::int n FROM coordinate_candidates')).rows[0].n,3);
  await db.query(await readFile('database/migrations/004_coordinate_audit_integrity.sql','utf8'));
  await db.query(await readFile('database/migrations/005_position_certainty.sql','utf8'));
  const upgraded=(await db.query('SELECT * FROM place_coordinates ORDER BY raw_latitude')).rows;
  assert.deepEqual(upgraded.map(({position_certainty,...row})=>row),all);
  assert(upgraded.every(row=>row.position_certainty===null));
  for(const f of (await readdir('database/migrations')).filter(f=>f.endsWith('.sql')&&f>'005_position_certainty.sql').sort())await db.query(await readFile('database/migrations/'+f,'utf8'));
  assert.deepEqual((await db.query('SELECT * FROM place_coordinates ORDER BY raw_latitude')).rows,upgraded);
  assert.equal((await db.query('SELECT corridor_order,deleted_at FROM places WHERE id=$1',[place])).rows[0].deleted_at,null);
 }catch(error){console.error("UPGRADE FAILURE",error);throw error;}finally{await db.end();await admin.query(`DROP DATABASE ${name} WITH (FORCE)`);await admin.end();}
});
