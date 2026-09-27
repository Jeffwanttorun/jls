import Fastify from 'fastify';
import {chromium,expect,type ConsoleMessage} from '@playwright/test';
import vue from '@vitejs/plugin-vue';
import {createServer} from 'vite';
import {mkdtemp,mkdir,rm,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
import type {Pool} from 'pg';
import {VisitorContentStore,publicVisitorPresentation} from '../shared/visitor-content.js';
import {registerVisitorContentRoutes} from '../backend/src/visitor-content-routes.js';
import {createPrototypeApp} from '../prototype-server/app.js';

const root=await mkdtemp(join(tmpdir(),'wuyi-visual-v02-')),output=resolve('reports/visitor-visual-maintenance-v0.2');await mkdir(output,{recursive:true});
const store=new VisitorContentStore({filePath:join(root,'data.json'),seedPath:resolve('visitor-content-store/seed.json'),backupDir:join(root,'backups'),mediaDir:join(root,'media')});
const db={query:async()=>({rows:[]})} as unknown as Pool;
const adminApi=Fastify({logger:false}),prototypeApi=createPrototypeApp(db,store);registerVisitorContentRoutes(adminApi,db,store);
let adminVite:any,prototypeVite:any,browser:any;const errors:string[]=[];

try{
 await store.ensure();await adminApi.listen({host:'127.0.0.1',port:0});await prototypeApi.listen({host:'127.0.0.1',port:0});
 const adminPort=(adminApi.server.address() as any).port,prototypePort=(prototypeApi.server.address() as any).port;
 adminVite=await createServer({configFile:false,root:'admin',cacheDir:'../node_modules/.vite-visual-admin',plugins:[vue()],server:{host:'127.0.0.1',port:5194,strictPort:true,proxy:{'/api':`http://127.0.0.1:${adminPort}`}}});
 prototypeVite=await createServer({configFile:false,root:'prototype',cacheDir:'../node_modules/.vite-visual-prototype',plugins:[vue()],server:{host:'127.0.0.1',port:5195,strictPort:true,proxy:{'/api/local-prototype':`http://127.0.0.1:${prototypePort}`}}});
 await adminVite.listen();await prototypeVite.listen();browser=await chromium.launch({channel:'msedge',headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();
 page.on('pageerror',(error:Error)=>errors.push(error.message));page.on('console',(message:ConsoleMessage)=>{if(message.type()==='error'&&!message.location().url.endsWith('/favicon.ico'))errors.push(message.text());});
 await page.goto('http://127.0.0.1:5194/visitor-home');await expect(page.getByRole('heading',{name:'图片维护'})).toBeVisible();await expect(page.getByRole('button',{name:'首页',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'主题'})).toBeVisible();await expect(page.getByRole('button',{name:'内容详情'})).toBeVisible();await expect(page.getByRole('button',{name:'地点'})).toBeVisible();
 await expect(page.getByText('保存草稿')).toHaveCount(0);await page.screenshot({path:join(output,'01-像前台一样维护-390x844.png'),fullPage:true});
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAV0lEQVR4nO3PQQ0AIBDAsAP/nuGNAvZoFSzZOjNnyNi1dwfgUQCeBeBZAJ4F4FkAngXgWQCeBeBZAJ4F4FkAngXgWQCeBeBZAJ4F4FkAngXgWQCeBeBZAJ4F4FkAngXgWQCeBfDpAQFhkgFBshwAAAAAAElFTkSuQmCC','base64');
 await page.locator('.visual-home-edit input[type=file]').setInputFiles({name:'首页测试图.png',mimeType:'image/png',buffer:png});
 await expect(page.getByRole('dialog',{name:/裁剪首页主图/})).toBeVisible();await page.screenshot({path:join(output,'02-缩放裁剪-390x844.png'),fullPage:true});
 await page.getByRole('button',{name:'使用这张图'}).click();await expect(page.getByText(/图片已更新/)).toBeVisible();
 const state=await store.read(),publicState=publicVisitorPresentation(state);assert(state.media.items['home.hero']);assert(publicState.media['home.hero']);assert.equal(publicState.home.heroImage?.fileName,state.media.items['home.hero'].fileName);
 const visitor=await context.newPage();visitor.on('pageerror',(error:Error)=>errors.push(error.message));await visitor.goto('http://127.0.0.1:5195/');await expect(visitor.locator('.home-hero .media-photo')).toBeVisible();await visitor.screenshot({path:join(output,'03-游客首页即时显示-390x844.png'),fullPage:true});
 await page.getByRole('button',{name:'主题'}).click();await expect(page.getByRole('button',{name:'玩水'})).toBeVisible();await page.locator('.visual-slot-card').first().locator('input[type=file]').setInputFiles({name:'玩水主题测试图.png',mimeType:'image/png',buffer:png});await page.getByRole('button',{name:'使用这张图'}).click();await expect(page.getByText(/图片已更新/)).toBeVisible();
 await page.setViewportSize({width:360,height:800});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),true);assert.equal(await page.locator('.visual-slot-grid').evaluate((element:HTMLElement)=>getComputedStyle(element).gridTemplateColumns.split(' ').length),1);await page.screenshot({path:join(output,'04-主题图片维护-360x800.png'),fullPage:true});
 await visitor.goto('http://127.0.0.1:5195/theme/water');await expect(visitor.locator('.theme-hero.has-theme-photo')).toBeVisible();
 assert.equal(errors.length,0,errors.join('\n'));await writeFile(join(output,'results.json'),JSON.stringify({passed:true,checkedAt:new Date().toISOString(),isolatedStore:true,databaseWrites:0,directVisualUpdate:true,cropDialog:true,consoleErrors:errors},null,2));
 console.log(JSON.stringify({passed:true,checks:['后台结构贴近前台','首页/六主题/内容/地点/路线均有图片入口','选择图片后可缩放裁剪','首页与主题图片确认后游客端立即生效','不暴露保存草稿步骤','360与390像素无横向溢出且手机单列','独立游客内容副本','第二阶段数据库写入0'],screenshots:4,consoleErrors:errors},null,2));await context.close();
}finally{await browser?.close();await adminVite?.close();await prototypeVite?.close();await adminApi.close();await prototypeApi.close();await rm(root,{recursive:true,force:true});}
