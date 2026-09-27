import 'dotenv/config';
import pg from 'pg';
import {writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const db=new pg.Pool({connectionString:process.env.DATABASE_URL});
try {
 const tables:Record<string,unknown>={};
 for(const {tablename} of (await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename<>'spatial_ref_sys' ORDER BY tablename")).rows){
  if(!/^[a-z_]+$/.test(tablename))throw Error('Unexpected table');
  tables[tablename]=(await db.query(`SELECT count(*)::int count,md5(string_agg(row_to_json(t)::text,E'\\n' ORDER BY row_to_json(t)::text)) checksum FROM ${tablename} t`)).rows[0];
 }
 const places=(await db.query('SELECT p.*,parent.code parent_code,t.code category_code,t.name category_name FROM places p LEFT JOIN places parent ON parent.id=p.parent_place_id JOIN taxonomy_terms t ON t.id=p.category_id ORDER BY p.code')).rows;
 const categories=(await db.query("SELECT code,name FROM taxonomy_terms WHERE dimension='一级分类' ORDER BY code")).rows;
 const snapshot={at:new Date().toISOString(),tables,places,categories,envSha256:createHash('sha256').update(await readFile('.env')).digest('hex')};
 await writeFile(process.argv[2],JSON.stringify(snapshot,null,2));
 console.log(JSON.stringify({tables,categories,places:places.map(p=>({code:p.code,name:p.name,parent:p.parent_code,region:p.region,status:p.current_status}))},null,2));
}finally{await db.end();}
