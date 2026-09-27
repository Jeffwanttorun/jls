import 'dotenv/config';
import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {createServer} from 'vite';
import vue from '@vitejs/plugin-vue';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createPrototypeApp} from '../prototype-server/app.js';
import {corridorBranchCodes,corridorCoreCodes,corridorEnd,corridorGeometry,corridorRouteSegments,corridorRouteSource,corridorServiceCodes,corridorStart} from '../prototype/src/routeConfig.js';
const themeSeed=JSON.parse(await readFile(new URL('../visitor-content-store/seed.json',import.meta.url),'utf8'));
const visitorThemes=themeSeed.themes.map((theme:any)=>({slug:theme.id,label:theme.name,entries:themeSeed.placeAssignments.filter((entry:any)=>entry.themeIds.includes(theme.id)).map((entry:any)=>({placeCode:entry.placeCode}))}));
const themeBySlug=Object.fromEntries(visitorThemes.map((theme:any)=>[theme.slug,theme]));
const familyFriendlyCodes=new Set<string>(themeSeed.placeAssignments.filter((entry:any)=>entry.familyFriendly).map((entry:any)=>entry.placeCode));
const isFamilyFriendly=(code:string)=>familyFriendlyCodes.has(code);
const themeLabelsForPlace=(code:string)=>{const assignment=themeSeed.placeAssignments.find((entry:any)=>entry.placeCode===code);return [...themeSeed.themes.filter((theme:any)=>assignment?.themeIds.includes(theme.id)).map((theme:any)=>theme.name),...(assignment?.familyFriendly?['适合带孩子']:[])];};

const output='reports/route-theme-v0.2';
const db=new pg.Pool({connectionString:process.env.DATABASE_URL});
const app=createPrototypeApp(db);
const browser=await chromium.launch({channel:'msedge',headless:true});
const checks:string[]=[],errors:string[]=[];
let vite:any,writes=0;

try{
  await mkdir(output+'/screenshots',{recursive:true});
  await app.listen({host:'127.0.0.1',port:3109});
  vite=await createServer({
    configFile:false,root:'prototype',cacheDir:'../node_modules/.vite-route-theme-tests',plugins:[vue()],
    server:{host:'127.0.0.1',port:5183,strictPort:true,https:{cert:await readFile(process.env.DEV_HTTPS_CERT!),key:await readFile(process.env.DEV_HTTPS_KEY!)},proxy:{'/api/local-prototype':'http://127.0.0.1:3109'}}
  });
  await vite.listen();

  assert.equal(corridorGeometry[0].latitude,27.6085563);
  assert.equal(corridorGeometry[0].longitude,117.9904387);
  assert.equal(corridorGeometry.at(-1)?.latitude,27.6642573);
  assert.equal(corridorGeometry.at(-1)?.longitude,117.6502617);
  assert.equal(corridorStart.code,'WY-0001');
  assert.equal(corridorEnd.code,'WY-0036');
  assert.equal(corridorGeometry.length,952);
  assert.equal(corridorRouteSegments.length,6);
  assert.equal(corridorRouteSource.sourceType,'tencent_driving_route_geometry');
  assert(corridorRouteSource.keyRoads.includes('武夷山国家公园1号风景道'));
  assert(corridorServiceCodes.every(code=>!corridorCoreCodes.includes(code)));
  assert(corridorBranchCodes.every(code=>!corridorCoreCodes.includes(code)));
  checks.push('主线使用腾讯驾车路线返回的952个道路几何点，分为6段连续缓存；起点南源岭、终点坳头，服务点和武夷源支线不参与几何');

  assert.deepEqual(visitorThemes.map((theme:any)=>theme.label),['玩水','风景','自然','茶','展馆','吃点东西']);
  const water=themeBySlug.water.entries.map((entry:any)=>entry.placeCode);
  for(const code of ['WY-0009','WY-0017','WY-0018','WY-0060','WY-0021','WY-0022'])assert(water.includes(code),code+' 未进入玩水主题');
  assert(!water.includes('WY-0050'));
  for(const code of ['WY-0051','WY-0052','WY-0053'])assert(!water.includes(code));
  assert.deepEqual(themeLabelsForPlace('WY-0012'),['风景','自然','适合带孩子']);
  assert(themeLabelsForPlace('WY-0024').includes('自然')&&themeLabelsForPlace('WY-0024').includes('适合带孩子'));
  assert(themeLabelsForPlace('WY-0028').includes('自然')&&themeLabelsForPlace('WY-0028').includes('展馆')&&themeLabelsForPlace('WY-0028').includes('适合带孩子'));
  assert(themeLabelsForPlace('WY-0040').includes('茶')&&themeLabelsForPlace('WY-0040').includes('展馆'));
  assert(themeLabelsForPlace('WY-0032').includes('茶')&&themeLabelsForPlace('WY-0032').includes('展馆'));
  assert(themeLabelsForPlace('WY-0056').includes('风景')&&themeLabelsForPlace('WY-0056').includes('茶'));
  assert(!visitorThemes.some((theme:any)=>theme.label==='亲子'));
  assert(familyFriendlyCodes.size>0&&isFamilyFriendly('WY-0012'));
  checks.push('游客端六类主题采用显式多对多映射；适合带孩子为独立集合，不再作为并列主题');

  const context=await browser.newContext({viewport:{width:390,height:844}});
  await context.addInitScript({path:'tests/tencent-sdk-stub.js'});
  await context.route('**/api/**',async route=>{
    if(!['GET','HEAD'].includes(route.request().method())){writes++;await route.abort();return;}
    await route.continue();
  });
  const page=await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});

  await page.goto('https://127.0.0.1:5183/');
  await expect(page.getByText('按心情出发',{exact:true})).toHaveCount(0);
  await expect(page.getByText('今天想做什么？',{exact:true})).toHaveCount(0);
  await expect(page.locator('.theme-grid a')).toHaveCount(6);
  await expect(page.locator('.kids-filter')).toHaveAttribute('aria-pressed','false');
  await page.locator('.kids-filter').click();
  await expect(page.locator('.kids-filter')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('.theme-grid a').first()).toHaveAttribute('href','/theme/water?kids=1');
  await page.locator('.kids-filter').click();
  await page.getByRole('button',{name:'看地图',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'游客地图'})).toBeVisible();
  let state=await page.evaluate(()=>(window as any).__mapTest);
  assert.equal(state.polylineGeometries.length,0);
  await expect(page.locator('[data-route-layer="hidden"]')).toHaveCount(1);
  await page.getByRole('button',{name:'一号风景道',exact:true}).click();
  await expect(page.getByText('南源岭 → 坳头村 / 坳头观景台',{exact:true})).toBeVisible();
  await expect.poll(async()=>((await page.evaluate(()=>(window as any).__mapTest.fitBoundsCount)) as number)).toBeGreaterThan(0);
  state=await page.evaluate(()=>(window as any).__mapTest);
  assert.equal(state.polylineGeometries.length,6);
  assert.equal(state.polylineGeometries.reduce((total:number,item:any,index:number)=>total+item.paths.length-(index?1:0),0),corridorGeometry.length);
  assert.equal(state.polylineStyles.at(-1).width,6);
  const routeMarkerCodes=state.geometries.map((item:any)=>item.id);
  assert(routeMarkerCodes.includes(corridorStart.code)&&routeMarkerCodes.includes(corridorEnd.code));
  assert(corridorBranchCodes.every(code=>!routeMarkerCodes.includes(code)));
  assert(corridorServiceCodes.every(code=>!routeMarkerCodes.includes(code)));
  checks.push('全部地点地图不加载路线图层；路线模式显示主线、自动适配范围、标出起终点，并在缩小时隐藏服务点和所有支线');

  for(const [slug,label,count] of [['water','玩水',6],['scenery','风景',7],['nature','自然',8],['tea','茶',4],['museum','展馆',8],['food','吃点东西',3]] as const){
    await page.goto('https://127.0.0.1:5183/theme/'+slug);
    await expect(page.getByRole('heading',{name:label,exact:true})).toBeVisible();
    await expect(page.locator('.theme-place-card')).toHaveCount(count);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),slug+' 390px横向溢出');
  }
  await page.goto('https://127.0.0.1:5183/theme/water');
  await expect(page.locator('.theme-place-card')).toHaveCount(6);
  const waterText=await page.locator('.theme-results').innerText();
  for(const name of ['漫水桥','观山听水','大峡谷农庄下河位置','小青龙瀑布','皮坑口玩水点','大浅滩'])assert(waterText.includes(name),name+' 未显示');
  assert(!/停车场|卫生间|旧竹筏码头河边/.test(waterText));
  assert.equal(await page.locator('.theme-place-card').filter({hasText:'月亮湾'}).count(),0);
  await page.goto('https://127.0.0.1:5183/theme/nature');
  await expect(page.locator('.theme-place-card')).toHaveCount(8);
  const moon=page.locator('.theme-place-card').filter({hasText:'月亮湾'});
  await expect(moon.getByText('自然',{exact:true})).toBeVisible();
  await expect(moon.getByText('适合带孩子',{exact:true})).toBeVisible();
  await expect(moon.getByText('这里可以看水景，但禁止下水。',{exact:true})).toBeVisible();
  const taoyuan=page.locator('.theme-place-card').filter({hasText:'桃源峪'});
  await expect(taoyuan.getByText('适合带孩子',{exact:true})).toBeVisible();
  await expect(taoyuan.getByText('自然',{exact:true})).toBeVisible();
  await expect(page.locator('.theme-place-card').filter({hasText:'昆虫展示馆（在建）'}).getByText('在建',{exact:true})).toBeVisible();
  await page.locator('.kids-filter').click();
  await expect(page.locator('.theme-place-card')).toHaveCount(6);
  checks.push('六个主题页显示显式配置的核心体验；月亮湾仅归风景/自然/带孩子并展示禁下水提醒，桃源峪归自然/带孩子；在建状态可见');

  const narrow=await browser.newContext({viewport:{width:360,height:800}});
  await narrow.addInitScript({path:'tests/tencent-sdk-stub.js'});
  const phone=await narrow.newPage();
  for(const path of ['/','/?kids=1','/corridor','/theme/water','/theme/water?kids=1','/theme/scenery','/theme/nature','/theme/tea','/theme/museum','/theme/food','/place/manshui','/place/tea','/place/butterfly','/place/xingcun']){
    await phone.goto('https://127.0.0.1:5183'+path);
    await phone.locator('h1:not(:empty)').first().waitFor();
    assert(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),path+' 360px横向溢出');
  }
  await narrow.close();
  checks.push('首页、路线、六个主题页和四个内容页在360px及390px无横向溢出');

  assert.equal((await app.inject({method:'POST',url:'/api/local-prototype/places'})).statusCode,404);
  assert.equal(writes,0);
  assert.deepEqual(errors,[]);
  checks.push('原型浏览器只发出GET/HEAD请求，API无写入路由，控制台无异常');

  const result={passed:true,checkedAt:new Date().toISOString(),checks,routeGeometrySource:corridorRouteSource.sourceType,routeGeometryPoints:corridorGeometry.length,routeSegments:corridorRouteSegments.length,waterPlaces:water.length,themes:visitorThemes.map((theme:any)=>({slug:theme.slug,count:theme.entries.length})),viewports:['390x844','360x800'],writeRequests:writes,consoleErrors:errors};
  await writeFile(output+'/browser-results.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
}finally{
  await browser.close();
  await vite?.close();
  await app.close();
  await db.end();
}



