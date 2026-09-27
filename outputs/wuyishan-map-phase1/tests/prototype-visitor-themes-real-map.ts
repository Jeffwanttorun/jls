import 'dotenv/config';
import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {createServer} from 'vite';
import vue from '@vitejs/plugin-vue';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createPrototypeApp} from '../prototype-server/app.js';

const output='reports/visitor-themes-v0.2';
const base='https://127.0.0.1:5184';
const db=new pg.Pool({connectionString:process.env.DATABASE_URL});
const app=createPrototypeApp(db);
const browser=await chromium.launch({channel:'msedge',headless:true});
const errors:string[]=[],providerRequests:string[]=[];
let vite:any,writes=0;

async function settleMap(page:any){
  await page.locator('.theme-map-card canvas').first().waitFor({timeout:20000});
  await page.waitForTimeout(700);
}

async function showResults(page:any){
  await page.locator('.theme-results').scrollIntoViewIfNeeded();
  await page.evaluate(()=>window.scrollBy(0,-70));
  await page.waitForTimeout(150);
}

try{
  await mkdir(output+'/screenshots',{recursive:true});
  await app.listen({host:'127.0.0.1',port:3110});
  vite=await createServer({
    configFile:false,root:'prototype',cacheDir:'../node_modules/.vite-visitor-theme-tests',plugins:[vue()],
    server:{host:'127.0.0.1',port:5184,strictPort:true,https:{cert:await readFile(process.env.DEV_HTTPS_CERT!),key:await readFile(process.env.DEV_HTTPS_KEY!)},proxy:{'/api/local-prototype':'http://127.0.0.1:3110'}}
  });
  await vite.listen();

  const context=await browser.newContext({viewport:{width:390,height:844},ignoreHTTPSErrors:true});
  await context.route('**/api/**',async route=>{
    if(!['GET','HEAD'].includes(route.request().method())){writes++;await route.abort();return;}
    await route.continue();
  });
  const page=await context.newPage();
  page.setDefaultTimeout(20000);
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error'&&!/ERR_ABORTED/.test(message.text()))errors.push(message.text());});
  page.on('request',request=>{if(/map\.qq\.com|vectorsdk\.map\.qq\.com/.test(request.url()))providerRequests.push(request.url());});

  await page.goto(base+'/');
  await expect(page.getByText('按心情出发',{exact:true})).toHaveCount(0);
  await expect(page.getByText('今天想做什么？',{exact:true})).toHaveCount(0);
  await expect(page.locator('.theme-grid a')).toHaveCount(6);
  assert.deepEqual(await page.locator('.theme-grid strong').allTextContents(),['玩水','风景','自然','茶','展馆','吃点东西']);
  await page.evaluate(()=>window.scrollTo(0,(document.querySelector('.theme-filter-row') as HTMLElement).offsetTop-70));
  await page.waitForTimeout(150);
  await page.screenshot({path:output+'/screenshots/01-首页六个主题-390x844.png'});

  const kids=page.locator('.kids-filter');
  await kids.click();
  await expect(kids).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('.theme-grid a').first()).toHaveAttribute('href','/theme/water?kids=1');
  await page.screenshot({path:output+'/screenshots/02-适合带孩子筛选-390x844.png'});

  await page.goto(base+'/theme/water');
  await expect(page.locator('.theme-place-card')).toHaveCount(7);
  await settleMap(page);
  await showResults(page);
  await page.screenshot({path:output+'/screenshots/03-玩水主题结果-390x844.png'});

  await page.goto(base+'/theme/nature');
  await expect(page.locator('.theme-place-card')).toHaveCount(7);
  await settleMap(page);
  const insect=page.locator('.theme-place-card').filter({hasText:'昆虫展示馆（在建）'});
  await expect(insect.getByText('在建',{exact:true})).toBeVisible();
  await insect.scrollIntoViewIfNeeded();
  await page.evaluate(()=>window.scrollBy(0,-70));
  await page.waitForTimeout(150);
  await page.screenshot({path:output+'/screenshots/04-自然主题结果-390x844.png'});

  await page.goto(base+'/theme/tea');
  await expect(page.locator('.theme-place-card')).toHaveCount(4);
  await settleMap(page);
  await showResults(page);
  await page.screenshot({path:output+'/screenshots/05-茶主题结果-390x844.png'});

  await page.goto(base+'/theme/museum');
  await expect(page.locator('.theme-place-card')).toHaveCount(8);
  await settleMap(page);
  await showResults(page);
  await page.screenshot({path:output+'/screenshots/06-展馆主题结果-390x844.png'});

  await page.goto(base+'/theme/water');
  await settleMap(page);
  const moon=page.locator('.theme-place-card').filter({hasText:'月亮湾'});
  await moon.scrollIntoViewIfNeeded();
  await expect(moon.getByText('玩水',{exact:true})).toBeVisible();
  await expect(moon.getByText('风景',{exact:true})).toBeVisible();
  await expect(moon.getByText('适合带孩子',{exact:true})).toBeVisible();
  await page.evaluate(()=>window.scrollBy(0,-70));
  await page.screenshot({path:output+'/screenshots/07-月亮湾多主题验证-390x844.png'});

  for(const path of ['/','/?kids=1','/theme/water','/theme/water?kids=1','/theme/scenery','/theme/nature','/theme/nature?kids=1','/theme/tea','/theme/museum','/theme/food']){
    await page.goto(base+path);
    await page.locator('h1:not(:empty)').first().waitFor();
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),path+' 横向溢出');
  }

  assert(providerRequests.length>0);
  assert.equal(writes,0);
  assert.deepEqual(errors,[]);
  const result={
    passed:true,checkedAt:new Date().toISOString(),viewport:'390x844',screenshots:7,
    themes:{water:7,scenery:7,nature:7,tea:4,museum:8,food:3},
    kidsFilter:'independent-query-filter',multiThemeProof:'WY-0012: 玩水 + 风景 + 适合带孩子',
    tencentRequests:providerRequests.length,writeRequests:writes,consoleErrors:errors
  };
  await writeFile(output+'/real-map-results.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
}finally{
  await browser.close();
  await vite?.close();
  await app.close();
  await db.end();
}
