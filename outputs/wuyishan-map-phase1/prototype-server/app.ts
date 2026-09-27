import Fastify from 'fastify';
import type {Pool} from 'pg';
import {VisitorContentStore,publicVisitorPresentation} from '../shared/visitor-content.js';

export function createPrototypeApp(db:Pool,contentStore=new VisitorContentStore()){
 const app=Fastify({logger:false});
 app.addHook('onReady',async()=>{await contentStore.ensure();});
 app.addHook('onRequest',async(_req,reply)=>{
  reply.header('Cache-Control','no-store');
  reply.header('X-Content-Type-Options','nosniff');
  reply.header('X-Prototype-Scope','local-internal-preview');
 });
 app.get('/health',async()=>{await db.query('SELECT 1');return {status:'ok',scope:'local-prototype'};});
 app.get('/api/local-prototype/map-config',async()=>({key:process.env.TENCENT_MAP_KEY||'',provider:'tencent',scope:'local-prototype'}));
 app.get('/api/local-prototype/presentation',async()=>({scope:'local-prototype',...publicVisitorPresentation(await contentStore.read())}));
 app.get('/api/local-prototype/preview/:id',async req=>({scope:'local-prototype',...publicVisitorPresentation(await contentStore.read(),(req.params as {id:string}).id)}));
 app.get('/api/local-prototype/media/:fileName',async(req,reply)=>{const fileName=String((req.params as any).fileName),extension=fileName.split('.').pop(),type=extension==='png'?'image/png':extension==='webp'?'image/webp':'image/jpeg';return reply.type(type).send(await contentStore.readImage(fileName));});
 app.get('/api/local-prototype/places',async()=>({scope:'local-prototype',items:(await db.query(`
  SELECT p.code,p.name,p.place_type,p.region,p.corridor_order,p.current_status status,
   CASE WHEN parent.deleted_at IS NULL AND parent.duplicate_of_place_id IS NULL THEN parent.code END parent_code,
   t.name category_name,c.map_latitude latitude,c.map_longitude longitude,
   (p.place_type<>'主地点' OR p.name ~ '(停车|卫生间|入口|路口|河滩|玩水点|观察区域|支线[12])') service
  FROM places p
  JOIN confirmed_place_coordinates c ON c.place_id=p.id
  JOIN taxonomy_terms t ON t.id=p.category_id
  LEFT JOIN places parent ON parent.id=p.parent_place_id
  WHERE p.deleted_at IS NULL AND p.duplicate_of_place_id IS NULL
  ORDER BY p.corridor_order ASC NULLS LAST,p.code
 `)).rows}));
 return app;
}


