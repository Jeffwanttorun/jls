import {createHash,randomUUID} from 'node:crypto';
import {mkdir,readFile,rename,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import type {FastifyInstance} from 'fastify';
import type {Pool,PoolClient} from 'pg';
import {studioStats,validateContentStudio,type ContentStudioDocument} from '../../shared/content-studio.js';
import {VisitorContentError} from '../../shared/visitor-content.js';

const workspaceId='wuyishan-knowledge-map';
const seedPath=resolve(process.env.CONTENT_STUDIO_SEED_PATH||'content-studio-store/seed.json');
const snapshotPath=resolve(process.env.CONTENT_STUDIO_SNAPSHOT_PATH||(process.env.VISITOR_CONTENT_STORE_PATH?resolve(dirname(process.env.VISITOR_CONTENT_STORE_PATH),'../content-studio/published.json'):'content-studio-store/published.json'));
const clone=<T>(value:T):T=>structuredClone(value);
const canonical=(value:unknown)=>JSON.stringify(value,Object.keys(value as object).sort());
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const contentRevision=(revision:number)=>`content-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${String(revision).padStart(4,'0')}`;

type WorkspaceRow={draft_revision:string;published_revision:string|null;draft:ContentStudioDocument;published:ContentStudioDocument|null;published_snapshot_hash:string|null;updated_at:string;published_at:string|null};

async function seedDocument(){return JSON.parse(await readFile(seedPath,'utf8')) as ContentStudioDocument;}
async function ensureWorkspace(db:Pool|PoolClient){
 const existing=await db.query<WorkspaceRow>('SELECT draft_revision,published_revision,draft,published,published_snapshot_hash,updated_at,published_at FROM content_workspaces WHERE id=$1',[workspaceId]);
 if(existing.rowCount)return existing.rows[0];
 const seed=await seedDocument(),snapshotHash=hash(seed),revision=contentRevision(1);
 const inserted=await db.query<WorkspaceRow>(`INSERT INTO content_workspaces(id,schema_version,draft_revision,published_revision,draft,published,published_snapshot_hash,published_at)
  VALUES($1,2,1,$2,$3,$3,$4,now()) RETURNING draft_revision,published_revision,draft,published,published_snapshot_hash,updated_at,published_at`,[workspaceId,revision,seed,snapshotHash]);
 await db.query(`INSERT INTO content_revision_history(workspace_id,revision_no,revision_id,change_kind,object_type,object_id,summary,snapshot,snapshot_hash)
  VALUES($1,1,$2,'seed','workspace',$1,'从当前公开网站导入初始内容',$3,$4)`,[workspaceId,revision,seed,snapshotHash]);
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

export function registerContentStudioRoutes(app:FastifyInstance,db:Pool){
 app.get('/api/admin/content-studio/state',async()=>{const row=await ensureWorkspace(db);return {draftRevision:Number(row.draft_revision),publishedRevision:row.published_revision,publishedSnapshotHash:row.published_snapshot_hash,updatedAt:row.updated_at,publishedAt:row.published_at,document:row.draft,dashboard:dashboard(row.draft)};});
 app.get('/api/admin/content-studio/revisions',async()=>({items:(await db.query(`SELECT revision_no,revision_id,change_kind,object_type,object_id,actor,summary,snapshot_hash,created_at FROM content_revision_history WHERE workspace_id=$1 ORDER BY revision_no DESC LIMIT 100`,[workspaceId])).rows}));
 app.post('/api/admin/content-studio/save',async(req)=>{
  const body=req.body as {expectedRevision:number;document:ContentStudioDocument;objectType?:string;objectId?:string;summary?:string};
  if(!Number.isInteger(body.expectedRevision)||!body.document)throw new VisitorContentError('草稿数据不完整');
  const issues=validateContentStudio(body.document);const errors=issues.filter(item=>item.level==='error');if(errors.length)throw new VisitorContentError(errors.map(item=>item.message).join('；'));
  const client=await db.connect();try{await client.query('BEGIN');const current=await ensureWorkspace(client);if(Number(current.draft_revision)!==body.expectedRevision)throw new VisitorContentError('内容已经被更新，请刷新后重新确认。',409);
   const next=body.expectedRevision+1,updated={...clone(body.document),updatedAt:new Date().toISOString()},snapshotHash=hash(updated),revision=contentRevision(next);
   await client.query(`UPDATE content_workspaces SET draft_revision=$2,draft=$3,updated_at=now() WHERE id=$1`,[workspaceId,next,updated]);
   await client.query(`INSERT INTO content_revision_history(workspace_id,revision_no,revision_id,change_kind,object_type,object_id,summary,snapshot,snapshot_hash) VALUES($1,$2,$3,'save',$4,$5,$6,$7,$8)`,[workspaceId,next,revision,body.objectType||'workspace',body.objectId||workspaceId,(body.summary||'保存可视化维护草稿').slice(0,500),updated,snapshotHash]);
   await client.query('COMMIT');return {ok:true,draftRevision:next,issues,dashboard:dashboard(updated)};
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 });
 app.post('/api/admin/content-studio/publish',async(req)=>{
  const body=req.body as {expectedRevision:number;acknowledgeWarnings?:boolean};const client=await db.connect();try{await client.query('BEGIN');const current=await ensureWorkspace(client);if(Number(current.draft_revision)!==body.expectedRevision)throw new VisitorContentError('草稿版本已变化，请刷新后重新发布。',409);
   const issues=validateContentStudio(current.draft);const errors=issues.filter(item=>item.level==='error'),warnings=issues.filter(item=>item.level==='warning');if(errors.length)throw new VisitorContentError(errors.map(item=>item.message).join('；'));if(warnings.length&&!body.acknowledgeWarnings)throw new VisitorContentError(`有 ${warnings.length} 项提醒，请在确认后发布。`,409);
   const revision=contentRevision(Number(current.draft_revision)),snapshotHash=hash(current.draft);
   await client.query(`UPDATE content_workspaces SET published=$2,published_revision=$3,published_snapshot_hash=$4,published_at=now() WHERE id=$1`,[workspaceId,current.draft,revision,snapshotHash]);
   await client.query(`INSERT INTO content_revision_history(workspace_id,revision_no,revision_id,change_kind,object_type,object_id,summary,snapshot,snapshot_hash) VALUES($1,$2,$3,'publish','workspace',$1,'发布内容快照',$4,$5) ON CONFLICT(workspace_id,revision_no) DO NOTHING`,[workspaceId,Number(current.draft_revision),revision,current.draft,snapshotHash]);
   await client.query('COMMIT');await writeSnapshot(current.draft,revision,snapshotHash);return {ok:true,contentRevision:revision,contentSnapshotHash:snapshotHash,warnings};
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 });
 app.post('/api/admin/content-studio/restore',async(req)=>{
  const body=req.body as {expectedRevision:number;revisionNo:number};const client=await db.connect();try{await client.query('BEGIN');const current=await ensureWorkspace(client);if(Number(current.draft_revision)!==body.expectedRevision)throw new VisitorContentError('草稿版本已变化，请刷新后重试。',409);
   const old=(await client.query<{snapshot:ContentStudioDocument}>('SELECT snapshot FROM content_revision_history WHERE workspace_id=$1 AND revision_no=$2',[workspaceId,body.revisionNo])).rows[0];if(!old)throw new VisitorContentError('找不到这个历史版本',404);
   const next=body.expectedRevision+1,restored={...clone(old.snapshot),updatedAt:new Date().toISOString()},snapshotHash=hash(restored),revision=contentRevision(next);
   await client.query('UPDATE content_workspaces SET draft_revision=$2,draft=$3,updated_at=now() WHERE id=$1',[workspaceId,next,restored]);
   await client.query(`INSERT INTO content_revision_history(workspace_id,revision_no,revision_id,change_kind,object_type,object_id,summary,snapshot,snapshot_hash) VALUES($1,$2,$3,'restore','workspace',$1,$4,$5,$6)`,[workspaceId,next,revision,`恢复到版本 ${body.revisionNo}`,restored,snapshotHash]);await client.query('COMMIT');return {ok:true,draftRevision:next};
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 });
 app.get('/api/admin/content-studio/export.json',async(_req,reply)=>{const row=await ensureWorkspace(db);reply.header('Content-Disposition',`attachment; filename="wuyishan-content-r${row.draft_revision}.json"`);return row.draft;});
 app.get('/api/admin/content-studio/export.geojson',async(_req,reply)=>{const row=await ensureWorkspace(db);return {type:'FeatureCollection',features:Object.values(row.draft.places).map(place=>({type:'Feature',id:place.id,properties:{id:place.id,name:place.name.zh,public:place.published},geometry:{type:'Point',coordinates:[place.coordinates.longitude,place.coordinates.latitude]}}))};});
 app.get('/api/admin/content-studio/preview/:kind/:id',async(req,reply)=>{const row=await ensureWorkspace(db),{kind,id}=req.params as {kind:string;id:string};if(kind==='place')return row.draft.places[id]||reply.code(404).send({error:'地点不存在'});if(kind==='route')return row.draft.routes.find(route=>route.id===id)||reply.code(404).send({error:'路线不存在'});return reply.code(404).send({error:'预览类型不存在'});});
}
