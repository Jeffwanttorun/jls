import 'dotenv/config';
import assert from 'node:assert/strict';import pg from 'pg';import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';import {resolve} from 'node:path';import {randomUUID,createHash} from 'node:crypto';
import {chromium,webkit,expect} from '@playwright/test';import {createServer} from 'vite';import vue from '@vitejs/plugin-vue';import JSZip from 'jszip';
import {VisitorContentStore} from '../shared/visitor-content.js';import {digest} from '../backend/src/studio-transfer.js';
process.env.LOCAL_CONTENT_ONLY='1';delete process.env.SITE_PUBLISH_SCRIPT;delete process.env.SITE_PROJECT_DIR;delete process.env.ADMIN_PASSWORD;
const origin=new URL(process.env.DATABASE_URL!);if(!['127.0.0.1','localhost'].includes(origin.hostname))throw Error('Test requires local database');
const root=new pg.Pool({connectionString:origin.toString()}),folder=resolve('../../work/local-hardening/tests',randomUUID()),dbNames:string[]=[],pools:pg.Pool[]=[],apps:any[]=[],checks:string[]=[];
await mkdir(folder,{recursive:true});
const {createApp}=await import('../backend/src/app.js');
async function isolated(){
 const name=`wymap_hardening_${randomUUID().replaceAll('-','')}`;await root.query(`CREATE DATABASE ${name}`);dbNames.push(name);const url=new URL(origin);url.pathname='/'+name;const pool=new pg.Pool({connectionString:url.toString()});pools.push(pool);
 await pool.query('CREATE TABLE schema_migrations(name text PRIMARY KEY,sha256 text NOT NULL,applied_at timestamptz DEFAULT now())');
 for(const migration of (await readdir('database/migrations')).filter(n=>n.endsWith('.sql')).sort()){const sql=await readFile(resolve('database/migrations',migration),'utf8');await pool.query('BEGIN');try{await pool.query(sql);await pool.query('INSERT INTO schema_migrations(name,sha256)VALUES($1,$2)',[migration,createHash('sha256').update(sql).digest('hex')]);await pool.query('COMMIT');}catch(e){await pool.query('ROLLBACK');throw e;}}
 const dir=resolve(folder,name);await mkdir(dir,{recursive:true});process.env.VISITOR_CONTENT_STORE_PATH=resolve(dir,'visitor.json');process.env.VISITOR_CONTENT_MEDIA_DIR=resolve(dir,'media');process.env.VISITOR_CONTENT_SEED_MEDIA_DIR=resolve('visitor-content-store/media');process.env.VISITOR_CONTENT_BACKUP_DIR=resolve(dir,'backups');process.env.CONTENT_STUDIO_SNAPSHOT_PATH=resolve(dir,'never-publish.json');
 const source=JSON.parse(await readFile('visitor-content-store/seed.json','utf8'));await writeFile(process.env.VISITOR_CONTENT_STORE_PATH,JSON.stringify(source));const store=new VisitorContentStore();await store.ensure();
 const app=createApp(pool);apps.push(app);return {pool,app,store};
}
const call=async(app:any,url:string,body?:unknown)=>{const r=await app.inject({method:body===undefined?'GET':'POST',url,payload:body});assert.equal(r.statusCode,200,r.body);return r.json();};
let vite:Awaited<ReturnType<typeof createServer>>|undefined,browser:any;
try{
 const a=await isolated(),state=await call(a.app,'/api/admin/content-studio/state'),publishedBefore=digest(state.document),doc=structuredClone(state.document),route=doc.routes[0],stage=route.stages.find((s:any)=>s.id==='huangcun-hongxing');
 for(const [index,name] of ['测试-黄村','测试-曹敦','测试-红星'].entries())stage.groups.push({id:`test-${index}`,title:{zh:name,en:''},summary:{zh:'',en:''},order:index*10,published:false,visible:true,archivedAt:null});
 const member=route.memberships.find((m:any)=>m.stageId===stage.id);member.groupId='test-1';doc.places[member.placeId].firsthandNotes.zh='隔离测试：录入与分组，不是真实资料';
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j9xkAAAAASUVORK5CYII=','base64');const image=await a.store.saveImage(png,'image/png','test.png');await a.store.mutate(undefined,d=>{d.media.items['content.test.asset']=image;});doc.places[member.placeId].photos=[{id:'test-photo',fileName:image.fileName,alt:{zh:'测试图片',en:''},role:'cover',order:0}];
 await call(a.app,'/api/admin/content-studio/save',{expectedRevision:state.draftRevision,document:doc,objectType:'route',objectId:route.id,summary:'隔离测试草稿'});
 const saved=await call(a.app,'/api/admin/content-studio/state');assert.equal(saved.document.routes[0].stages.find((s:any)=>s.id===stage.id).groups.length,3);assert.equal(digest((await a.pool.query('SELECT published FROM content_workspaces')).rows[0].published),publishedBefore);
 checks.push('真实 PostgreSQL 草稿分组、移动地点、地点编辑、图片引用保存；公开快照不变');
 const publishedSnapshotHash=saved.publishedSnapshotHash;
 for(const url of ['/api/admin/content-studio/publish','/api/admin/site-publish','/api/admin/visitor-content/home/publish'])assert.equal((await a.app.inject({method:'POST',url,payload:{expectedRevision:2,acknowledgeWarnings:true}})).statusCode,403);
 checks.push('本地模式在 API 层拦截 Content Studio、旧维护台与网站发布');
 const stale=await a.app.inject({method:'POST',url:'/api/admin/content-studio/save',payload:{expectedRevision:1,document:saved.document}});assert.equal(stale.statusCode,409);
 const exportResponse=await a.app.inject('/api/admin/content-studio/export.zip');assert.equal(exportResponse.statusCode,200,exportResponse.body);const zipBytes=exportResponse.rawPayload;await writeFile(resolve(folder,'draft-roundtrip.zip'),zipBytes);
 const b=await isolated(),initialB=await call(b.app,'/api/admin/content-studio/state'),publicB=digest(initialB.document);
 const upload=async(mode:string,query='')=>b.app.inject({method:'POST',url:`/api/admin/content-studio/import?mode=${mode}${query}`,headers:{'Content-Type':'application/zip'},payload:zipBytes});
 const beforeImport=digest((await call(b.app,'/api/admin/content-studio/state')).document),preview=await upload('preview');assert.equal(preview.statusCode,200,preview.body);assert.equal(digest((await call(b.app,'/api/admin/content-studio/state')).document),beforeImport);
 const checked=preview.json(),imported=await upload('apply',`&expectedRevision=${checked.expectedRevision}&archiveHash=${checked.archiveHash}`);assert.equal(imported.statusCode,200,imported.body);
 const restored=await call(b.app,'/api/admin/content-studio/state');assert.equal(digest(restored.document),digest(saved.document));assert.equal(digest((await b.pool.query('SELECT published FROM content_workspaces')).rows[0].published),publicB);assert((await b.store.readImage(image.fileName)).equals(png));assert.equal(restored.publishedSnapshotHash,initialB.publishedSnapshotHash);
 checks.push('导出 → 全新数据库 → 预检查（不写入）→ 导入：所有草稿字段、路线关系、geometry 摘要、图片字节一致');
 assert.equal((await upload('apply',`&expectedRevision=${checked.expectedRevision}&archiveHash=${checked.archiveHash}`)).statusCode,409);
 const broken=await JSZip.loadAsync(zipBytes);broken.file('draft.json','{}');const corrupted=await broken.generateAsync({type:'nodebuffer'});assert.equal((await b.app.inject({method:'POST',url:'/api/admin/content-studio/import?mode=preview',headers:{'Content-Type':'application/zip'},payload:corrupted})).statusCode,400);
 checks.push('过期草稿导入被拒绝；损坏内容包被拒绝；历史可恢复为新草稿');
 await call(b.app,'/api/admin/content-studio/restore',{expectedRevision:restored.draftRevision,revisionNo:1});const recovered=(await call(b.app,'/api/admin/content-studio/state')).document;assert.equal(digest({...recovered,updatedAt:initialB.document.updatedAt}),publicB);
 // Two simultaneous saves cannot silently overwrite the same revision.
 const raceState=await call(b.app,'/api/admin/content-studio/state');const races=await Promise.all([1,2].map(()=>b.app.inject({method:'POST',url:'/api/admin/content-studio/save',payload:{expectedRevision:raceState.draftRevision,document:raceState.document}})));assert.deepEqual(races.map(r=>r.statusCode).sort(),[200,409]);checks.push('同时保存同版本：一份成功、一份 409，防止静默覆盖');
 await a.app.listen({port:3019,host:'127.0.0.1'});vite=await createServer({configFile:false,root:'admin',cacheDir:'../node_modules/.vite-local-hardening',plugins:[vue()],server:{host:'127.0.0.1',port:5178,strictPort:true,proxy:{'/api':'http://127.0.0.1:3019'}}});await vite.listen();
 const screenshots=resolve(folder,'screenshots');await mkdir(screenshots,{recursive:true});
 for(const engine of ['chromium','webkit']){
  try{browser=engine==='webkit'?await webkit.launch({headless:true}):await chromium.launch({channel:'msedge',headless:true});}catch(e){if(engine==='webkit'){checks.push('WebKit 运行时未安装；未声称真实 iPhone 验收');continue;}throw e;}
  for(const width of [390,375]){
   const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors:string[]=[];page.on('pageerror',(e:any)=>errors.push(e.message));await page.goto('http://127.0.0.1:5178/studio');await expect(page.getByRole('heading',{name:'本地草稿模式'})).toBeVisible();await expect(page.getByRole('button',{name:'更新公开网站'})).toHaveCount(0);
   await page.getByPlaceholder('野猴谷、WY-0030、桐木、红茶').fill('野猴谷');await expect(page.locator('.studio-search-results a')).not.toHaveCount(0);
   await page.goto('http://127.0.0.1:5178/studio/routes/no-1-scenic-road');const stageCard=page.locator('.route-stage-card').nth(3);await stageCard.getByRole('button',{name:'＋ 添加分组'}).click();await stageCard.locator('.route-group-heading input').last().fill('UI隔离测试分组');
   // Use the actual option generated for the new group (no mocked API).
   const select=stageCard.locator('.fallback .route-place-row select').filter({has:page.locator('option',{hasText:'UI隔离测试分组'})}).first();await select.selectOption({label:'UI隔离测试分组'});
   await page.getByRole('button',{name:'保存路线草稿'}).click();await expect(page.getByText(/草稿已保存/)).toBeVisible();await page.getByRole('button',{name:'预览本地草稿'}).click();await expect(page.locator('.route-draft-preview')).toContainText('UI隔离测试分组');await page.screenshot({path:resolve(screenshots,`${engine}-route-${width}.png`),fullPage:true});
   await page.goto('http://127.0.0.1:5178/studio/places/WY-0030');await page.getByRole('button',{name:'现场更新',exact:true}).click();await page.getByRole('button',{name:'最近核验 = 今天'}).click();const field=page.getByPlaceholder('添加一条实地记录');await field.fill('');await field.pressSequentially('abcdef');assert.equal(await field.inputValue(),'abcdef');await field.fill('真实 API 的手机宽度测试');await page.getByRole('button',{name:'保存现场草稿'}).click();await expect(page.getByText(/草稿已保存/)).toBeVisible();await page.getByRole('button',{name:'预览本地草稿'}).click();await expect(page.locator('.place-live-preview')).toBeVisible();
   await page.goto('http://127.0.0.1:5178/studio/media');await page.locator('input[type=file]').setInputFiles({name:'browser-test.png',mimeType:'image/png',buffer:png});await expect(page.getByText(/已上传 browser-test/)).toBeVisible();await expect(page.locator('.media-library-grid img').first()).toBeVisible();
   await page.goto('http://127.0.0.1:5178/studio/history');await page.locator('input[type=file]').setInputFiles({name:'draft.zip',mimeType:'application/zip',buffer:zipBytes});await page.getByRole('button',{name:'检查导入包'}).click();await expect(page.locator('.import-preview')).toContainText('41 个地点');const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert(layout.scroll<=layout.width,JSON.stringify(layout));assert.deepEqual(errors,[]);await page.screenshot({path:resolve(screenshots,`${engine}-import-${width}.png`),fullPage:true});await context.close();
  }
  checks.push(`${engine} 375/390px：真实 API 草稿创建/分组移动/保存/预览/连续输入/图片上传/导入预检查通过`);await browser.close();browser=null;
 }
 assert.equal((await call(a.app,'/api/admin/content-studio/state')).publishedSnapshotHash,publishedSnapshotHash);
 await writeFile(resolve(folder,'results.json'),JSON.stringify({passed:true,checks,isolatedDatabases:true,productionOperations:false,physicalIphoneTest:false,checkedAt:new Date().toISOString()},null,2));console.log(JSON.stringify({passed:true,checks,report:resolve(folder,'results.json')},null,2));
}finally{await browser?.close();await vite?.close();for(const app of apps)await app.close();for(const pool of pools)await pool.end();for(const name of dbNames)await root.query(`DROP DATABASE ${name} WITH(FORCE)`);await root.end();}
