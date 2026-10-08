import {createHash,randomUUID} from 'node:crypto';
import {mkdir,readFile,rename,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import type {FastifyInstance} from 'fastify';
import type {Pool,PoolClient} from 'pg';
import {studioStats,validateContentStudio,type ContentStudioDocument} from '../../shared/content-studio.js';
import {VisitorContentError,VisitorContentStore} from '../../shared/visitor-content.js';
import {digest,exportStudioArchive,readStudioArchive,validateTransferDocument} from './studio-transfer.js';
import {emptyStudioPlace,type PlaceCreationContext} from '../../shared/studio-place-creation.js';
import type {StudioPlace} from '../../shared/content-studio.js';

const workspaceId='wuyishan-knowledge-map';
const seedPath=resolve(process.env.CONTENT_STUDIO_SEED_PATH||'content-studio-store/seed.json');
const snapshotPath=resolve(process.env.CONTENT_STUDIO_SNAPSHOT_PATH||(process.env.VISITOR_CONTENT_STORE_PATH?resolve(dirname(process.env.VISITOR_CONTENT_STORE_PATH),'../content-studio/published.json'):'content-studio-store/published.json'));
const clone=<T>(value:T):T=>structuredClone(value);
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const contentRevision=(revision:number)=>`content-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${String(revision).padStart(4,'0')}`;

type WorkspaceRow={draft_revision:string;published_revision:string|null;draft:ContentStudioDocument;published:ContentStudioDocument|null;published_snapshot_hash:string|null;updated_at:string;published_at:string|null};

async function seedDocument(){return JSON.parse(await readFile(seedPath,'utf8')) as ContentStudioDocument;}
async function ensureWorkspace(db:Pool|PoolClient,lock=false){
 const existing=await db.query<WorkspaceRow>('SELECT draft_revision,published_revision,draft,published,published_snapshot_hash,updated_at,published_at FROM content_workspaces WHERE id=$1'+(lock?' FOR UPDATE':''),[workspaceId]);
 if(existing.rowCount)return existing.rows[0];
 const seed=await seedDocument(),snapshotHash=hash(seed),revision=contentRevision(1);
 const inserted=await db.query<WorkspaceRow>(`INSERT INTO content_workspaces(id,schema_version,draft_revision,published_revision,draft,published,published_snapshot_hash,published_at)
  VALUES($1,2,1,$2,$3,$3,$4,now()) ON CONFLICT(id) DO NOTHING RETURNING draft_revision,published_revision,draft,published,published_snapshot_hash,updated_at,published_at`,[workspaceId,revision,seed,snapshotHash]);
 if(!inserted.rowCount)return ensureWorkspace(db,lock);
 await db.query(`INSERT INTO content_revision_history(workspace_id,revision_no,revision_id,change_kind,object_type,object_id,summary,snapshot,snapshot_hash)
  VALUES($1,1,$2,'seed','workspace',$1,'从当前公开网站导入初始内容',$3,$4) ON CONFLICT(workspace_id,revision_no) DO NOTHING`,[workspaceId,revision,seed,snapshotHash]);
 return inserted.rows[0];
}

async function writeSnapshot(document:ContentStudioDocument,revision:string,snapshotHash:string){
 await mkdir(dirname(snapshotPath),{recursive:true});const temp=`${snapshotPath}.${process.pid}.${randomUUID()}.tmp`;
 await writeFile(temp,JSON.stringify({schemaVersion:2,contentRevision:revision,contentSnapshotHash:snapshotHash,publishedAt:new Date().toISOString(),document},null,2)+'\n',{flag:'wx'});await rename(temp,snapshotPath);
}

function dashboard(document:ContentStudioDocument){
 const issues=validateContentStudio(document),stats=studioStats(document),places=Object.values(document.places);
 const issueCounts=Object.fromEntries([...new Set(issues.map(i=>i.code))].map(code=>[code,issues.filter(i=>i.code===code).length]));
 return {stats,issues,issueCounts,recentPlaces:places.slice().sort((a,b)=>a.id.localeCompare(b.id)).slice(0,8)};
}

export function registerContentStudioRoutes(app:FastifyInstance,db:Pool,store=new VisitorContentStore()){
 app.post('/api/admin/content-studio/places/create',async(req)=>{
  const body=req.body as {expectedRevision:number;requestId:string;place:StudioPlace;document?:ContentStudioDocument;contexts?:PlaceCreationContext[]};
  if(!body||!Number.isInteger(body.expectedRevision)||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(body.requestId||'')||!body.place?.name?.zh?.trim())throw new VisitorContentError('请填写中文名称；创建请求不完整');
  const client=await db.connect();
  try{
   await client.query('BEGIN');const current=await ensureWorkspace(client,true);
   await client.query('SELECT pg_advisory_xact_lock(91724003)');
   const retry=(await client.query('SELECT code FROM studio_place_codes WHERE request_id=$1',[body.requestId])).rows[0];
   if(retry){await client.query('COMMIT');return {ok:true,id:retry.code,draftRevision:Number(current.draft_revision),document:current.draft};}
   if(Number(current.draft_revision)!==body.expectedRevision)throw new VisitorContentError('草稿已变化，请保留表单并刷新后重试。',409);
   const document=clone(body.document||current.draft);
   // New places must enter through the allocator, never through a client supplied ID.
   if(Object.keys(document.places).some(id=>!current.draft.places[id])||Object.keys(current.draft.places).some(id=>!document.places[id]))throw new VisitorContentError('创建时不能增删其他地点');
   const n=(await client.query("SELECT COALESCE(MAX(substring(code FROM 4)::bigint),0)+1 AS n FROM studio_place_codes")).rows[0].n;
   const id=`WY-${String(n).padStart(4,'0')}`,place={...emptyStudioPlace(),...clone(body.place),id,archivedAt:null};
   place.name.zh=place.name.zh.trim();if(place.coordinateMissing)place.published=false;else if(place.coordinates.system!=='WGS84')throw new VisitorContentError('新地点资料坐标必须为 WGS84');
   document.places[id]=place;
   const seen=new Set<string>();
   for(const context of body.contexts||[]){
    const route=document.routes.find(r=>r.id===context.routeId&&!r.archivedAt),stage=route?.stages.find(s=>s.id===context.stageId&&!s.archivedAt);
    if(!route||!stage||context.groupId&&!stage.groups.some(g=>g.id===context.groupId&&!g.archivedAt)||seen.has(route.id)||!Number.isFinite(context.order))throw new VisitorContentError('路线、阶段或分组关联无效');
    seen.add(route.id);route.memberships.push({placeId:id,stageId:stage.id,groupId:context.groupId,role:context.role,order:context.order,visible:true});
   }
   document.updatedAt=new Date().toISOString();validateTransferDocument(document,await seedDocument());
   for(const photo of place.photos)await store.readImage(photo.fileName);
   const next=Number(current.draft_revision)+1;
   await client.query('INSERT INTO studio_place_codes(code,request_id)VALUES($1,$2)',[id,body.requestId]);
   await client.query('UPDATE content_workspaces SET draft_revision=$2,draft=$3,updated_at=now() WHERE id=$1',[workspaceId,next,document]);
   await client.query(`INSERT INTO content_revision_history(workspace_id,revision_no,revision_id,change_kind,object_type,object_id,summary,snapshot,snapshot_hash) VALUES($1,$2,$3,'save','place',$4,$5,$6,$7)`,[workspaceId,next,contentRevision(next),id,`新建地点草稿：${place.name.zh}`,document,hash(document)]);
   await client.query('COMMIT');return {ok:true,id,draftRevision:next,document};
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
 });
 app.get('/api/admin/content-studio/state',async()=>{const row=await ensureWorkspace(db);return {localOnly:process.env.LOCAL_CONTENT_ONLY==='1',draftRevision:Number(row.draft_revision),publishedRevision:row.published_revision,publishedSnapshotHash:row.published_snapshot_hash,publishedPlaceIds:Object.values(row.published?.places||{}).filter(p=>p.published&&!p.archivedAt).map(p=>p.id),updatedAt:row.updated_at,publishedAt:row.published_at,document:row.draft,dashboard:dashboard(row.draft)};});
 app.get('/api/admin/content-studio/revisions',async()=>({items:(await db.query(`SELECT revision_no,revision_id,change_kind,object_type,object_id,actor,summary,snapshot_hash,created_at FROM content_revision_history WHERE workspace_id=$1 ORDER BY revision_no DESC LIMIT 100`,[workspaceId])).rows}));
 app.post('/api/admin/content-studio/save',async(req)=>{
  const body=req.body as {expectedRevision:number;document:ContentStudioDocument;objectType?:string;objectId?:string;summary?:string};
  if(!Number.isInteger(body.expectedRevision)||!body.document)throw new VisitorContentError('草稿数据不完整');
  validateTransferDocument(body.document,await seedDocument());
  const issues=validateContentStudio(body.document);const errors=issues.filter(item=>item.level==='error');if(errors.length)throw new VisitorContentError(errors.map(item=>item.message).join('；'));
  const client=await db.connect();try{await client.query('BEGIN');const current=await ensureWorkspace(client,true);if(Number(current.draft_revision)!==body.expectedRevision)throw new VisitorContentError('内容已经被更新，请刷新后重新确认。',409);
   const next=body.expectedRevision+1,updated={...clone(body.document),updatedAt:new Date().toISOString()},snapshotHash=hash(updated),revision=contentRevision(next);
   await client.query(`UPDATE content_workspaces SET draft_revision=$2,draft=$3,updated_at=now() WHERE id=$1`,[workspaceId,next,updated]);
   await client.query(`INSERT INTO content_revision_history(workspace_id,revision_no,revision_id,change_kind,object_type,object_id,summary,snapshot,snapshot_hash) VALUES($1,$2,$3,'save',$4,$5,$6,$7,$8)`,[workspaceId,next,revision,body.objectType||'workspace',body.objectId||workspaceId,(body.summary||'保存可视化维护草稿').slice(0,500),updated,snapshotHash]);
   await client.query('COMMIT');return {ok:true,draftRevision:next,issues,dashboard:dashboard(updated)};
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 });
 app.post('/api/admin/content-studio/publish',async(req)=>{
  if(process.env.LOCAL_CONTENT_ONLY==='1')throw new VisitorContentError('本地录入模式只保存草稿，已禁止发布。',403);
  const body=req.body as {expectedRevision:number;acknowledgeWarnings?:boolean};const client=await db.connect();try{await client.query('BEGIN');const current=await ensureWorkspace(client);if(Number(current.draft_revision)!==body.expectedRevision)throw new VisitorContentError('草稿版本已变化，请刷新后重新发布。',409);
   const issues=validateContentStudio(current.draft,true);const errors=issues.filter(item=>item.level==='error'),warnings=issues.filter(item=>item.level==='warning');if(errors.length)throw new VisitorContentError(errors.map(item=>item.message).join('；'));if(warnings.length&&!body.acknowledgeWarnings)throw new VisitorContentError(`有 ${warnings.length} 项提醒，请在确认后发布。`,409);
   const revision=contentRevision(Number(current.draft_revision)),snapshotHash=hash(current.draft);
   await client.query(`UPDATE content_workspaces SET published=$2,published_revision=$3,published_snapshot_hash=$4,published_at=now() WHERE id=$1`,[workspaceId,current.draft,revision,snapshotHash]);
   await client.query(`INSERT INTO content_revision_history(workspace_id,revision_no,revision_id,change_kind,object_type,object_id,summary,snapshot,snapshot_hash) VALUES($1,$2,$3,'publish','workspace',$1,'发布内容快照',$4,$5) ON CONFLICT(workspace_id,revision_no) DO NOTHING`,[workspaceId,Number(current.draft_revision),revision,current.draft,snapshotHash]);
   await client.query('COMMIT');await writeSnapshot(current.draft,revision,snapshotHash);return {ok:true,contentRevision:revision,contentSnapshotHash:snapshotHash,warnings};
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 });
 app.post('/api/admin/content-studio/restore',async(req)=>{
  const body=req.body as {expectedRevision:number;revisionNo:number};const client=await db.connect();try{await client.query('BEGIN');const current=await ensureWorkspace(client,true);if(Number(current.draft_revision)!==body.expectedRevision)throw new VisitorContentError('草稿版本已变化，请刷新后重试。',409);
   const old=(await client.query<{snapshot:ContentStudioDocument}>('SELECT snapshot FROM content_revision_history WHERE workspace_id=$1 AND revision_no=$2',[workspaceId,body.revisionNo])).rows[0];if(!old)throw new VisitorContentError('找不到这个历史版本',404);
   const next=body.expectedRevision+1,restored={...clone(old.snapshot),updatedAt:new Date().toISOString()},snapshotHash=hash(restored),revision=contentRevision(next);
   await client.query('UPDATE content_workspaces SET draft_revision=$2,draft=$3,updated_at=now() WHERE id=$1',[workspaceId,next,restored]);
   await client.query(`INSERT INTO content_revision_history(workspace_id,revision_no,revision_id,change_kind,object_type,object_id,summary,snapshot,snapshot_hash) VALUES($1,$2,$3,'restore','workspace',$1,$4,$5,$6)`,[workspaceId,next,revision,`恢复到版本 ${body.revisionNo}`,restored,snapshotHash]);await client.query('COMMIT');return {ok:true,draftRevision:next};
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 });
 app.get('/api/admin/content-studio/export.zip',async(_req,reply)=>{
  const client=await db.connect();try{await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');const row=await ensureWorkspace(client);const history=(await client.query('SELECT * FROM content_revision_history WHERE workspace_id=$1 ORDER BY revision_no',[workspaceId])).rows;const reservedCodes=(await client.query('SELECT code FROM studio_place_codes ORDER BY code')).rows.map(r=>r.code as string);const archive=await exportStudioArchive(row,history,store,reservedCodes);await client.query('COMMIT');return reply.type('application/zip').header('Content-Disposition',`attachment; filename="wuyishan-studio-r${row.draft_revision}.zip"`).send(archive);}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
 });
 app.addContentTypeParser('application/zip',{parseAs:'buffer',bodyLimit:200*1024*1024},(_req,body,done)=>done(null,body));
 app.post('/api/admin/content-studio/import',{bodyLimit:200*1024*1024},async(req)=>{
  const {mode,expectedRevision,archiveHash}=req.query as {mode?:string;expectedRevision?:string;archiveHash?:string};
  if(mode!=='preview'&&mode!=='apply')throw new VisitorContentError('请选择预检查或导入草稿');
  const archive=await readStudioArchive(req.body as Buffer,await seedDocument()),current=await ensureWorkspace(db);
  const summary={archiveHash:archive.archiveHash,documentHash:digest(archive.document),places:Object.keys(archive.document.places).length,routes:archive.document.routes.length,groups:archive.document.routes.flatMap(r=>r.stages.flatMap(s=>s.groups)).length,media:archive.manifest.media.length,sourceRevision:archive.manifest.draftRevision,expectedRevision:Number(current.draft_revision),issues:validateContentStudio(archive.document)};
  if(mode==='preview')return summary;
  if(archiveHash!==archive.archiveHash||!Number.isInteger(Number(expectedRevision)))throw new VisitorContentError('请先校验同一个导出包');
  const client=await db.connect();try{await client.query('BEGIN');const locked=await ensureWorkspace(client,true);if(Number(locked.draft_revision)!==Number(expectedRevision))throw new VisitorContentError('草稿已变化，请重新预检查导入包。',409);
   for(const entry of archive.manifest.media){const saved=await store.saveImage(archive.files.get(`media/${entry.fileName}`)!,entry.asset.mimeType,entry.asset.originalName);if(saved.fileName!==entry.fileName)throw new VisitorContentError('图片类型和摘要不匹配');}
   // Merge media only. The legacy home/published content in the archive is evidence,
   // never applied to a public snapshot by a draft import.
   await store.ensure();await store.mutate(undefined,draft=>{for(const entry of archive.manifest.media)draft.media.items[`content.library-${entry.asset.id}.asset`]=entry.asset;draft.media.version++;draft.media.updatedAt=new Date().toISOString();});
   await client.query('SELECT pg_advisory_xact_lock(91724003)');
   for(const code of archive.manifest.reservedCodes||[])await client.query('INSERT INTO studio_place_codes(code)VALUES($1)ON CONFLICT DO NOTHING',[code]);
   const next=Number(locked.draft_revision)+1,revision=contentRevision(next);
   await client.query('UPDATE content_workspaces SET draft_revision=$2,draft=$3,updated_at=now() WHERE id=$1',[workspaceId,next,archive.document]);
   await client.query(`INSERT INTO content_revision_history(workspace_id,revision_no,revision_id,change_kind,object_type,object_id,summary,snapshot,snapshot_hash) VALUES($1,$2,$3,'save','import',$1,$4,$5,$6)`,[workspaceId,next,revision,`导入完整草稿包（来源 r${archive.manifest.draftRevision}），保留当前公开快照`,archive.document,summary.documentHash]);
   await client.query('COMMIT');return {ok:true,draftRevision:next,...summary};
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
 });
 app.get('/api/admin/content-studio/export.json',async(_req,reply)=>{const row=await ensureWorkspace(db);reply.header('Content-Disposition',`attachment; filename="wuyishan-content-r${row.draft_revision}.json"`);return row.draft;});
 app.get('/api/admin/content-studio/export.geojson',async(_req,reply)=>{const row=await ensureWorkspace(db);return {type:'FeatureCollection',features:Object.values(row.draft.places).map(place=>({type:'Feature',id:place.id,properties:{id:place.id,name:place.name.zh,public:place.published},geometry:{type:'Point',coordinates:[place.coordinates.longitude,place.coordinates.latitude]}}))};});
 app.get('/api/admin/content-studio/preview/:kind/:id',async(req,reply)=>{const row=await ensureWorkspace(db),{kind,id}=req.params as {kind:string;id:string};if(kind==='place')return row.draft.places[id]||reply.code(404).send({error:'地点不存在'});if(kind==='route')return row.draft.routes.find(route=>route.id===id)||reply.code(404).send({error:'路线不存在'});return reply.code(404).send({error:'预览类型不存在'});});
}
