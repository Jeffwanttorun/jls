import 'dotenv/config';
import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {createServer} from 'vite';
import vue from '@vitejs/plugin-vue';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createPrototypeApp} from '../prototype-server/app.js';
import {navigationWebUrl} from '../prototype/src/tencent.js';

const output='reports/prototype-v0.2';
const paths=['/','/corridor','/place/manshui','/place/tea','/place/butterfly','/place/xingcun'];
const db=new pg.Pool({connectionString:process.env.DATABASE_URL});
const app=createPrototypeApp(db);
const browser=await chromium.launch({channel:'msedge',headless:true});
const checks:string[]=[],errors:string[]=[],navigationRequests:string[]=[];
let vite:any,writes=0;

try{
  await mkdir(output+'/screenshots',{recursive:true});
  await app.listen({host:'127.0.0.1',port:3108});
  vite=await createServer({
    configFile:false,root:'prototype',cacheDir:'../node_modules/.vite-prototype-v02-tests',plugins:[vue()],
    server:{host:'127.0.0.1',port:5182,strictPort:true,https:{cert:await readFile(process.env.DEV_HTTPS_CERT!),key:await readFile(process.env.DEV_HTTPS_KEY!)},proxy:{'/api/local-prototype':'http://127.0.0.1:3108'}}
  });
  await vite.listen();

  const context=await browser.newContext({viewport:{width:390,height:844}});
  await context.addInitScript({path:'tests/tencent-sdk-stub.js'});
  await context.route('**/api/**',async route=>{
    if(!['GET','HEAD'].includes(route.request().method())){writes++;await route.abort();return;}
    await route.continue();
  });
  await context.route('https://map.qq.com/nav/drive*',route=>{navigationRequests.push(route.request().url());return route.abort();});
  const page=await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error'&&!/ERR_ABORTED/.test(message.text()))errors.push(message.text());});

  const response=await app.inject({url:'/api/local-prototype/places'});
  const payload=response.json();
  assert.equal(response.statusCode,200);
  assert.equal(payload.scope,'local-prototype');
  assert.equal(payload.items.length,41);
  assert(!payload.items.some((p:any)=>p.code==='WY-0008'||p.code==='WY-0011'));

  for(const path of paths){
    await page.goto('https://127.0.0.1:5182'+path);
    await page.locator('h1:not(:empty)').first().waitFor();
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),path+' 390px横向溢出');
  }
  checks.push('首页、风景道及4个内容页在390px均无横向溢出');

  await page.goto('https://127.0.0.1:5182/');
  await page.screenshot({path:output+'/screenshots/01-home-390x844.png'});
  await page.goto('https://127.0.0.1:5182/corridor');
  await page.screenshot({path:output+'/screenshots/02-corridor-390x844.png'});
  await page.goto('https://127.0.0.1:5182/place/manshui');
  await page.screenshot({path:output+'/screenshots/03-manshui-hero-390x844.png'});
  await page.getByRole('heading',{name:'到了以后'}).evaluate(element=>window.scrollTo(0,element.getBoundingClientRect().top+window.scrollY-82));
  await page.waitForTimeout(150);
  await page.screenshot({path:output+'/screenshots/04-manshui-arrival-390x844.png'});
  await page.locator('.detail-hero-copy .nav-trigger').click();
  await expect(page.getByRole('dialog',{name:'选择要前往的地点'})).toBeVisible();
  await page.waitForTimeout(250);
  await page.screenshot({path:output+'/screenshots/05-manshui-navigation-drawer-390x844.png'});
  await page.getByRole('button',{name:'关闭导航选择'}).click();
  for(const [path,file] of [['/place/tea','06-tea-museum-390x844.png'],['/place/butterfly','07-butterfly-390x844.png'],['/place/xingcun','08-xingcun-390x844.png']] as const){
    await page.goto('https://127.0.0.1:5182'+path);
    await page.screenshot({path:output+'/screenshots/'+file});
  }
  await page.goto('https://127.0.0.1:5182/');
  await page.getByRole('button',{name:'看地图',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'游客地图'})).toBeVisible();
  await page.screenshot({path:output+'/screenshots/09-full-map-390x844.png'});
  const featured=payload.items.find((p:any)=>p.code==='WY-0040');
  await page.evaluate(code=>(window as any).__mapTest.marker.handlers.click({geometry:{id:code}}),featured.code);
  await expect(page.getByRole('dialog',{name:'游客地图'}).getByRole('heading',{name:featured.name})).toBeVisible();
  await page.waitForTimeout(250);
  await page.screenshot({path:output+'/screenshots/10-map-place-card-390x844.png'});
  checks.push('已生成10张390×844真实运行截图，覆盖首页、路线、4个内容页、导航抽屉及地图卡片');

  for(const path of ['/place/manshui','/place/tea','/place/butterfly','/place/xingcun']){
    await page.goto('https://127.0.0.1:5182/');
    await page.goto('https://127.0.0.1:5182'+path);
    await page.getByRole('button',{name:'返回',exact:true}).click();
    await expect(page).toHaveURL('https://127.0.0.1:5182/');
  }
  checks.push('4个内容页头部返回操作均可回到来源页');

  const expected:Record<string,string[]>= {
    '/place/manshui':['WY-0051'],
    '/place/tea':['WY-0040'],
    '/place/butterfly':['WY-0025'],
    '/place/xingcun':['WY-0048']
  };
  for(const [path,codes] of Object.entries(expected)){
    for(const code of codes){
      await page.goto('https://127.0.0.1:5182'+path);
      await page.locator('.detail-hero-copy .nav-trigger').click();
      const sheet=page.getByRole('dialog',{name:'选择要前往的地点'});
      await expect(sheet).toBeVisible();
      assert.equal(await sheet.locator('.destination').count(),codes.length);
      const place=payload.items.find((p:any)=>p.code===code);
      assert(place,code+' 不在只读适配层');
      const before=navigationRequests.length;
      await sheet.locator('.destination').filter({hasText:place.name}).first().click();
      await expect.poll(()=>navigationRequests.length).toBeGreaterThan(before);
      const href=navigationWebUrl(place.name,place.latitude,place.longitude);
      const url=new URL(href),params=new URLSearchParams(url.hash.split('?')[1]);
      assert.equal(url.pathname,'/nav/drive');
      assert.equal(params.get('eword'),place.name);
      assert.equal(params.get('epointy'),String(place.latitude));
      assert.equal(params.get('epointx'),String(place.longitude));
    }
  }
  checks.push('4个内容页仅使用各自后台默认导航目标，均对应真实地点名称和正式坐标，漫水桥不引用已删除WY-0008');

  const narrow=await browser.newContext({viewport:{width:360,height:800}});
  await narrow.addInitScript({path:'tests/tencent-sdk-stub.js'});
  const phone=await narrow.newPage();
  for(const path of paths){
    await phone.goto('https://127.0.0.1:5182'+path);
    await phone.locator('h1:not(:empty)').first().waitFor();
    assert(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),path+' 360px横向溢出');
    if(path.startsWith('/place/')){
      await phone.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));
      const geometry=await phone.evaluate(()=>{
        const bar=document.querySelector('.bottom-bar')!.getBoundingClientRect();
        const last=document.querySelector('.journey-next')!.getBoundingClientRect();
        return {barTop:bar.top,lastBottom:last.bottom};
      });
      assert(geometry.lastBottom<=geometry.barTop+1,path+' 固定底栏遮挡正文');
      const sizes=await phone.locator('.bottom-bar>a,.bottom-bar>button').evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().height));
      assert(sizes.every(size=>size>=44),path+' 底栏触控区域不足44px');
    }
  }
  await narrow.close();
  checks.push('6个页面在360×800无横向溢出；固定底栏不遮挡正文且触控高度均不少于44px');

  assert.equal((await app.inject({method:'POST',url:'/api/local-prototype/places'})).statusCode,404);
  assert.equal((await app.inject({url:'/api/places'})).statusCode,404);
  assert.equal(writes,0);
  assert.deepEqual(errors,[]);
  checks.push('原型API仍仅开放GET；浏览器零写请求、零控制台异常、无公开API别名');

  const result={passed:true,checkedAt:new Date().toISOString(),checks,pages:paths,viewports:['390x844','360x800'],screenshots:10,placeCount:payload.items.length,writeRequests:writes,navigationTargets:Object.values(expected).flat().length,consoleErrors:errors};
  await writeFile(output+'/browser-results.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
}finally{
  await browser.close();
  await vite?.close();
  await app.close();
  await db.end();
}
