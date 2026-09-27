import 'dotenv/config';
import {chromium,expect,type Page} from '@playwright/test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import vue from '@vitejs/plugin-vue';
import {mkdir,writeFile} from 'node:fs/promises';
import {corridorGeometry,corridorRouteSegments} from '../prototype/src/routeConfig.js';

const output='reports/core-interaction-v0.2';
const base='http://127.0.0.1:5195';
const api='http://127.0.0.1:3002';
await mkdir(output+'/screenshots',{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
const checks:string[]=[],errors:string[]=[];
let vite:any,writes=0;

async function openThemeMap(page:Page,slug:string){
 await page.goto(`${base}/theme/${slug}`);
 await page.locator('.theme-hero').getByRole('button',{name:'查看地图',exact:true}).click();
 const map=page.getByRole('dialog',{name:'游客地图'});await expect(map).toBeVisible();return map;
}

async function assertThemeBackground(page:Page,map:ReturnType<Page['locator']>){
 await expect(map).toHaveAttribute('data-map-scope','theme');
 await expect(map).toHaveAttribute('data-route-layer','visible');
 await expect(map).toHaveAttribute('data-route-presentation','background');
 await expect(map.locator('.route-map-key')).toHaveCount(0);
 await expect(map.locator('.route-caption')).toHaveCount(0);
 await expect(map.locator('.map-card')).toHaveCount(0);
 await expect.poll(async()=>page.evaluate(()=>(window as any).__mapTest.polylineGeometries.length)).toBe(6);
 const state=await page.evaluate(()=>(window as any).__mapTest);
 assert.equal(state.polylineGeometries.reduce((sum:number,item:any,index:number)=>sum+item.paths.length-(index?1:0),0),corridorGeometry.length);
 assert.deepEqual(state.polylineGeometries.map((item:any)=>item.id),corridorRouteSegments.map(item=>item.id));
 assert(state.polylineGeometries.every((item:any)=>item.properties.kind==='main-corridor'));
 assert.equal(state.polylineStyles.at(-1).width,3);
 assert.equal(state.polylineStyles.at(-1).color,'rgba(23,107,76,.36)');
 await expect.poll(async()=>page.evaluate(()=>(window as any).__mapTest.fitBoundsHistory.at(-1)?.pointCount||0)).toBeGreaterThan(1);
 const fitted=await page.evaluate(()=>(window as any).__mapTest.fitBoundsHistory.at(-1)?.pointCount||0);
 assert(fitted<100,'主题视野错误使用整条952点路线');
}

try{
 vite=await createServer({configFile:false,root:'prototype',cacheDir:'../node_modules/.vite-core-interaction-v02',plugins:[vue()],server:{host:'127.0.0.1',port:5195,strictPort:true,proxy:{'/api/local-prototype':api}}});await vite.listen();
 const context=await browser.newContext({viewport:{width:390,height:844}});await context.addInitScript({path:'tests/tencent-sdk-stub.js'});
 await context.route('**/api/**',async route=>{if(!['GET','HEAD'].includes(route.request().method())){writes++;await route.abort();return;}await route.continue();});
 const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});

 await page.goto(base+'/theme/scenery');
 const qiyun=page.locator('.theme-place-card').filter({hasText:'齐云峰'});
 await expect(qiyun.getByRole('button',{name:'导航到这里',exact:true})).toBeVisible();
 await expect(qiyun.getByRole('button',{name:'查看地图',exact:true})).toBeVisible();
 await qiyun.getByRole('button',{name:'导航到这里',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'选择要前往的地点'})).toBeVisible();
 await expect(page.getByRole('dialog',{name:'游客地图'})).toHaveCount(0);
 await expect(page.getByRole('dialog',{name:'选择要前往的地点'}).locator('.destination')).toContainText('齐云峰观景/日出位置');
 await page.getByRole('button',{name:'关闭导航选择'}).click();
 checks.push('齐云峰地点卡首层同时提供导航和查看地图，导航不以地图为前置步骤');

 await qiyun.getByRole('button',{name:'查看地图',exact:true}).click();
 const single=page.getByRole('dialog',{name:'游客地图'});await expect(single).toBeVisible();
 await expect(single).toHaveAttribute('data-map-scope','single-place');
 await expect(single).toHaveAttribute('data-selected-code','WY-0004');
 await expect(single).toHaveAttribute('data-visible-codes','WY-0004');
 await expect(single).toHaveAttribute('data-route-presentation','none');
 await expect(single.locator('.map-card')).toBeVisible();
 await expect(single.locator('.map-context-caption span')).toHaveCount(0);
 await expect(single.getByRole('button',{name:'导航到这里',exact:true})).toBeVisible();
 const detailLink=single.getByRole('link',{name:'查看详情',exact:true});await expect(detailLink).toBeVisible();await expect(detailLink).toHaveAttribute('href','/location/WY-0004');
 await single.getByRole('button',{name:'关闭地点卡'}).click();await expect(single.locator('.map-card')).toHaveCount(0);
 await page.evaluate(()=>(window as any).__mapTest.marker.handlers.click({geometry:{id:'WY-0004'}}));await expect(single.locator('.map-card')).toBeVisible();
 checks.push('single-place自动选中齐云峰并打开地点卡；关闭后地图保留，重点marker可重新打开卡片；无路线或无意义计数');

 await single.getByRole('link',{name:'查看详情',exact:true}).click();await expect(page).toHaveURL(/\/location\/WY-0004$/);await expect(page.locator('.place-detail-copy h1')).toHaveText('齐云峰观景/日出位置');const facilities=page.getByRole('region',{name:'本地点设施'});await expect(facilities).toContainText('卫生间');await expect(facilities).toContainText('餐馆');await expect(facilities).not.toContainText('南源岭卫生间');await expect(facilities).not.toContainText('三才峰附近卫生间');await expect(facilities.locator('.facility-row').filter({hasText:'卫生间'}).locator('.facility-mark')).toHaveText('✓');await expect(facilities.locator('.facility-row').filter({hasText:'餐馆'}).locator('.facility-mark')).toHaveText('×');await expect(facilities.locator('.facility-row').filter({hasText:'餐馆'}).getByRole('button',{name:'导航'})).toBeDisabled();await expect(page.locator('body')).not.toContainText('117.931874');
 await facilities.locator('.facility-row').filter({hasText:'卫生间'}).getByRole('button',{name:'导航'}).click();await expect(page.getByRole('dialog',{name:'选择要前往的地点'}).locator('.destination')).toContainText('齐云峰观景/日出位置');await page.getByRole('button',{name:'关闭导航选择'}).click();await page.screenshot({path:output+'/screenshots/13-齐云峰地点详情与本地点设施-390x844.png',fullPage:true});
 checks.push('齐云峰地图的查看详情进入独立地点详情页，只显示本地点设施：卫生间可导航，餐馆禁用导航');
 await page.goto(base+'/theme/scenery');
 const moon=page.locator('.theme-place-card').filter({hasText:'月亮湾'});await moon.scrollIntoViewIfNeeded();
 await expect(moon.getByRole('button',{name:'导航到这里',exact:true})).toBeVisible();await expect(moon.getByRole('button',{name:'查看地图',exact:true})).toBeVisible();
 const actionBox=await moon.locator('.theme-place-actions').boundingBox(),alertBox=await moon.locator('.visitor-alert').boundingBox();assert(actionBox&&alertBox&&alertBox.y>=actionBox.y+actionBox.height-1);
 await expect(moon.locator('.visitor-alert')).toContainText('禁止下水');
 checks.push('月亮湾导航和查看地图直接可见，禁止下水提醒位于操作之后、正文浏览之前');

 await page.goto(base+'/place/butterfly');const hero=page.locator('.detail-hero-copy');
 await expect(hero.getByRole('button',{name:'导航到这里',exact:true})).toBeVisible();await expect(hero.getByRole('button',{name:'查看地图',exact:true})).toBeVisible();
 await hero.getByRole('button',{name:'导航到这里',exact:true}).click();await expect(page.getByRole('dialog',{name:'选择要前往的地点'}).locator('.destination')).toContainText('桃源峪停车位置');await page.getByRole('button',{name:'关闭导航选择'}).click();
 await hero.getByRole('button',{name:'查看地图',exact:true}).click();const contentMap=page.getByRole('dialog',{name:'游客地图'});await expect(contentMap).toHaveAttribute('data-map-scope','content-unit');await expect(contentMap).toHaveAttribute('data-route-presentation','none');await expect(contentMap.locator('.map-card')).toHaveCount(0);
 checks.push('组合详情首屏复用后台默认导航目标；content-unit保持组合视野，不自动弹卡且无主线路线');

 for(const slug of ['water','scenery','nature','tea','museum']){const map=await openThemeMap(page,slug);await assertThemeBackground(page,map);checks.push(`${slug}主题只显示主题marker并复用既有6段道路背景，视野未适配整条路线`);}
 const familyMap=await openThemeMap(page,'water?kids=1');await assertThemeBackground(page,familyMap);const familyCodes=(await familyMap.getAttribute('data-visible-codes')||'').split(',').filter(Boolean);assert(familyCodes.length>0&&familyCodes.length<6);checks.push('主题加适合带孩子保持真实交集和道路背景');

 await page.goto(base+'/');await page.getByRole('button',{name:'看地图',exact:true}).click();const allMap=page.getByRole('dialog',{name:'游客地图'});await expect(allMap).toHaveAttribute('data-map-scope','all-places');await expect(allMap).toHaveAttribute('data-route-presentation','none');await expect(allMap).toHaveAttribute('data-selected-code','');
 await allMap.getByRole('button',{name:'一号风景道',exact:true}).click();await expect(allMap).toHaveAttribute('data-map-scope','route');await expect(allMap).toHaveAttribute('data-route-presentation','primary');await expect(allMap.locator('.route-map-key')).toBeVisible();await expect(allMap.locator('.route-caption')).toBeVisible();await expect(allMap).toHaveAttribute('data-selected-code','');
 checks.push('all-places无路线；route mode保持完整路线、图例、起终点表达且不默认选中地点');

 const narrow=await browser.newContext({viewport:{width:360,height:800}});await narrow.addInitScript({path:'tests/tencent-sdk-stub.js'});const phone=await narrow.newPage();
 for(const path of ['/theme/scenery','/theme/water','/theme/nature','/place/butterfly','/location/WY-0004']){await phone.goto(base+path);assert(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),path+' 360px横向溢出');}
 await phone.goto(base+'/location/WY-0004');await phone.screenshot({path:output+'/screenshots/14-齐云峰地点详情与本地点设施-360x800.png',fullPage:true});
 await narrow.close();checks.push('390×844与360×800无横向溢出');

 assert.equal(writes,0);assert.deepEqual(errors,[]);await context.close();
 const result={passed:true,checkedAt:new Date().toISOString(),checks,routePoints:corridorGeometry.length,routeSegments:corridorRouteSegments.length,writeRequests:writes,consoleErrors:errors};await writeFile(output+'/browser-results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await browser.close();await vite?.close();}
