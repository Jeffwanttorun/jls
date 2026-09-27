import 'dotenv/config';
import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {createServer} from 'vite';
import vue from '@vitejs/plugin-vue';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createPrototypeApp} from '../prototype-server/app.js';
import {VisitorContentStore,addVisitorHistory} from '../shared/visitor-content.js';

const root=await mkdtemp(join(tmpdir(),'wuyi-refresh-v02-')),store=new VisitorContentStore({filePath:join(root,'data.json'),seedPath:resolve('visitor-content-store/seed.json'),backupDir:join(root,'backups'),mediaDir:join(root,'media')}),db=new pg.Pool({connectionString:process.env.DATABASE_URL,max:2});
await store.ensure();const app=createPrototypeApp(db,store),browser=await chromium.launch({channel:'msedge',headless:true});let vite:any;
try{await app.listen({host:'127.0.0.1',port:3112});vite=await createServer({configFile:false,root:'prototype',cacheDir:'../node_modules/.vite-visitor-refresh',plugins:[vue()],server:{host:'127.0.0.1',port:5188,strictPort:true,proxy:{'/api/local-prototype':'http://127.0.0.1:3112'}}});await vite.listen();const page=await browser.newPage({viewport:{width:390,height:844}});await page.goto('http://127.0.0.1:5188/theme/scenery');await expect(page.getByText('月亮湾').first()).toBeVisible();assert.equal(await page.getByText('月亮湾（后台更新已生效）').count(),0);
 const version=(await store.read()).version;await store.mutate(version,d=>{const item=d.placeAssignments.find(a=>a.placeCode==='WY-0012')!;item.titleByTheme.scenery='月亮湾（后台更新已生效）';item.version++;addVisitorHistory(d,'place_theme',item.placeCode,'refresh_proof','月亮湾','月亮湾（后台更新已生效）');return null;});await page.reload();await expect(page.getByText('月亮湾（后台更新已生效）',{exact:true}).first()).toBeVisible();await page.screenshot({path:'reports/visitor-content-admin-v0.2/screenshots/27-visitor-refresh-effect.png',fullPage:true});const result={passed:true,storeKind:'random-isolated-temp',beforeVersion:version,afterVersion:(await store.read()).version,realDatabaseWrites:0};await writeFile('reports/visitor-content-admin-v0.2/refresh-results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser.close();await vite?.close();await app.close();await db.end();await rm(root,{recursive:true,force:true});}

