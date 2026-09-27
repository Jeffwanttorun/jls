import 'dotenv/config';
import {chromium,expect,type Page} from '@playwright/test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {createServer} from 'vite';
import vue from '@vitejs/plugin-vue';
import {mkdir,writeFile} from 'node:fs/promises';
import {navigationAppUrl,navigationWebUrl} from '../prototype/src/tencent.js';

const output='reports/navigation-mapscope-v0.2';
const base='http://127.0.0.1:5193';
const api='http://127.0.0.1:3002';
const db=new pg.Pool({connectionString:process.env.DATABASE_URL,max:2});
await mkdir(output+'/screenshots',{recursive:true});
const places=(await (await fetch(api+'/api/local-prototype/places')).json()).items as any[];
const presentation=await (await fetch(api+'/api/local-prototype/presentation')).json() as any;
const browser=await chromium.launch({channel:'msedge',headless:true});
let vite:any,writes=0;
const checks:string[]=[],errors:string[]=[],navigationRequests:string[]=[],generatedNavigation:string[]=[];

function place(code:string){const result=places.find(item=>item.code===code);assert(result,`missing ${code}`);return result;}
function defaultTarget(slug:string){const content=presentation.contents.find((item:any)=>item.document.slug===slug);assert(content,`missing ${slug}`);const target=content.document.navigationTargets.find((item:any)=>item.isDefault);assert(target,`missing default target for ${slug}`);return place(target.placeCode);}
function assertTarget(urlText:string,target:any){
 const url=new URL(urlText);
 assert.equal(url.protocol,'https:');assert.equal(url.hostname,'map.qq.com');assert.equal(url.pathname,'/nav/drive');assert(url.hash.startsWith('#routes/page?'));
 const hashParams=new URLSearchParams(url.hash.slice('#routes/page?'.length));assert.equal(hashParams.get('transport'),'2');assert.equal(hashParams.get('eword'),target.name);assert.equal(hashParams.get('epointx'),String(target.longitude));assert.equal(hashParams.get('epointy'),String(target.latitude));
 const app=new URL(navigationAppUrl(target.name,target.latitude,target.longitude,'test-referer'));assert.equal(app.protocol,'qqmap:');assert.equal(app.pathname,'/routeplan');assert.equal(app.searchParams.get('to'),target.name);assert.equal(app.searchParams.get('tocoord'),`${target.latitude},${target.longitude}`);assert.equal(app.searchParams.get('referer'),'test-referer');
}
async function assertConfirmedGcj02(target:any){
 const result=await db.query(`SELECT c.map_latitude latitude,c.map_longitude longitude,c.map_coordinate_system coordinate_system FROM places p JOIN confirmed_place_coordinates c ON c.place_id=p.id WHERE p.code=$1`,[target.code]);
 assert.equal(result.rows.length,1);assert.equal(result.rows[0].coordinate_system,'GCJ-02');assert.equal(result.rows[0].latitude,target.latitude);assert.equal(result.rows[0].longitude,target.longitude);
}
async function captureDialogNavigation(page:Page,target:any){
 const before=navigationRequests.length;
 const dialog=page.getByRole('dialog',{name:'选择要前往的地点'});await expect(dialog).toBeVisible();
 const choices=dialog.locator('button.destination');assert.equal(await choices.count(),1);await expect(choices.first()).toContainText(target.name);
 await choices.first().click();await expect.poll(()=>navigationRequests.length).toBe(before+1);const url=navigationWebUrl(target.name,target.latitude,target.longitude);assertTarget(url,target);generatedNavigation.push(url);return url;
}
async function captureContentNavigation(page:Page,slug:string,target:any){
 await page.goto(base+'/place/'+slug);const trigger=page.locator('.detail-hero-copy').getByRole('button',{name:'导航到这里',exact:true});await expect(trigger).toBeVisible();await trigger.click();return captureDialogNavigation(page,target);
}
async function captureThemePlaceNavigation(page:Page,name:string,code:string){
 const target=place(code);await page.goto(base+'/theme/scenery');const card=page.locator('.theme-place-card').filter({hasText:name});await card.getByRole('button',{name:'查看地图'}).click();const map=page.getByRole('dialog',{name:'游客地图'});await expect(map).toBeVisible();await expect(map).toHaveAttribute('data-selected-code',code);await map.getByRole('button',{name:'导航到这里',exact:true}).click();return {target,url:await captureDialogNavigation(page,target)};
}

try{
 vite=await createServer({configFile:false,root:'prototype',cacheDir:'../node_modules/.vite-navigation-v0.2',plugins:[vue()],server:{host:'127.0.0.1',port:5193,strictPort:true,proxy:{'/api/local-prototype':api}}});await vite.listen();
 const context=await browser.newContext({viewport:{width:390,height:844}});await context.addInitScript({path:'tests/tencent-sdk-stub.js'});
 await context.route('**/api/**',async route=>{if(!['GET','HEAD'].includes(route.request().method())){writes++;await route.abort();}else await route.continue();});
 await context.route('https://map.qq.com/nav/drive*',async route=>{navigationRequests.push(route.request().url());await route.abort();});
 const page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',error=>errors.push(error.message));

 const qiyun=await captureThemePlaceNavigation(page,'齐云峰','WY-0004');checks.push('齐云峰导航名称、GCJ-02正式坐标及腾讯H5/App URI正确');
 const moon=await captureThemePlaceNavigation(page,'月亮湾','WY-0012');checks.push('月亮湾导航名称、正式坐标及腾讯URI正确');
 const tea=defaultTarget('tea');await captureContentNavigation(page,'tea',tea);assert.equal(tea.code,'WY-0040');checks.push('黄村乌龙茶展示馆使用后台默认导航目标');
 const butterfly=defaultTarget('butterfly');await captureContentNavigation(page,'butterfly',butterfly);assert.equal(butterfly.code,'WY-0025');checks.push('桃源峪+蝴蝶馆只使用后台默认的桃源峪停车位置');
 const manshui=defaultTarget('manshui');await captureContentNavigation(page,'manshui',manshui);assert.equal(manshui.code,'WY-0051');checks.push('漫水桥只使用后台默认的停车场1');
 for(const target of [qiyun.target,moon.target,tea,butterfly,manshui])await assertConfirmedGcj02(target);
 checks.push('5个导航目标均逐值来自当前唯一active正式坐标，地图坐标系均为GCJ-02');
 assert.equal(new URLSearchParams(new URL(qiyun.url).hash.slice('#routes/page?'.length)).get('eword'),qiyun.target.name);assert.equal(new URLSearchParams(new URL(moon.url).hash.slice('#routes/page?'.length)).get('eword'),moon.target.name);

 const noNav=await context.newPage();
 await noNav.route('**/api/local-prototype/presentation',async route=>{const response=await route.fetch();const body=await response.json();const item=body.contents.find((entry:any)=>entry.document.slug==='tea');item.document.navigationTargets=[];await route.fulfill({response,json:body});});
 await noNav.goto(base+'/place/tea');await expect(noNav.locator('.detail-hero-copy .nav-unavailable')).toHaveText('暂未设置导航位置');await expect(noNav.locator('.detail-hero-copy .nav-trigger')).toHaveCount(0);checks.push('无默认导航目标时不生成导航按钮或错误外链');

 const refreshed=await context.newPage();
 await refreshed.route('**/api/local-prototype/presentation',async route=>{const response=await route.fetch();const body=await response.json();const item=body.contents.find((entry:any)=>entry.document.slug==='butterfly');for(const target of item.document.navigationTargets)target.isDefault=target.placeCode==='WY-0028';await route.fulfill({response,json:body});});
 await refreshed.goto(base+'/place/butterfly');await refreshed.locator('.detail-hero-copy').getByRole('button',{name:'导航到这里',exact:true}).click();const changed=refreshed.getByRole('dialog',{name:'选择要前往的地点'}).locator('button.destination');assert.equal(await changed.count(),1);await expect(changed).toContainText(place('WY-0028').name);checks.push('后台默认导航从 A 改为 B 后，游客端刷新即读取 B（只读响应替身验证）');

 assert.equal(writes,0);assert.deepEqual(errors,[]);await context.close();
 const result={passed:true,checkedAt:new Date().toISOString(),checks,navigationCases:5,writeRequests:writes,consoleErrors:errors,externalTargets:generatedNavigation.map(value=>{const url=new URL(value),params=new URLSearchParams(url.hash.slice('#routes/page?'.length));return {to:params.get('eword'),longitude:params.get('epointx'),latitude:params.get('epointy'),endpoint:url.origin+url.pathname};})};
 await writeFile(output+'/navigation-browser-results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await browser.close();await vite?.close();await db.end();}

