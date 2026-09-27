import {chromium,expect,type Page} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';

const base='https://127.0.0.1:5174',output='reports/mobile-map-ui-v0.2',screenshots=output+'/screenshots';
await mkdir(screenshots,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},ignoreHTTPSErrors:true});
const page=await context.newPage(),errors:string[]=[],localWrites:string[]=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{const url=message.location().url;if(message.type()==='error'&&!url.endsWith('/favicon.ico'))errors.push(message.text()+' @ '+url);});
page.on('request',request=>{if(request.url().includes('/api/')&&!['GET','HEAD'].includes(request.method()))localWrites.push(request.method()+' '+request.url());});
page.setDefaultTimeout(20000);

async function mapReady(){
  await expect(page.getByRole('dialog',{name:'游客地图'})).toBeVisible();
  await expect(page.locator('.map-cover')).toHaveCount(0);
  await page.waitForTimeout(1800);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
}
async function selectCenteredMarker(){
  const box=await page.locator('.full-map .map-canvas').boundingBox();assert(box);
  await page.mouse.click(box.x+box.width/2,box.y+box.height/2-22);
  await expect(page.locator('.map-card')).toBeVisible();
}
async function shot(name:string){await page.screenshot({path:screenshots+'/'+name,animations:'disabled'});}

try{
  await page.goto(base+'/theme/scenery',{waitUntil:'domcontentloaded'});
  await page.locator('.theme-place-card').filter({hasText:'齐云峰'}).getByRole('button',{name:'查看地图'}).click();
  await mapReady();await shot('01-qiyun-marker-complete.png');
  await selectCenteredMarker();await shot('02-qiyun-sheet-default.png');
  await page.getByRole('button',{name:'展开地点详情'}).click();await page.waitForTimeout(350);await shot('03-qiyun-sheet-expanded.png');
  await page.getByRole('button',{name:'收起地点详情'}).click();await page.waitForTimeout(350);await page.locator('.map-card-scroll').evaluate(element=>element.scrollTop=element.scrollHeight);await page.waitForTimeout(100);await shot('04-qiyun-sheet-bottom.png');
  await page.getByRole('button',{name:'关闭地点卡'}).click();await expect(page.locator('.map-card')).toHaveCount(0);await shot('05-qiyun-sheet-closed.png');

  await page.goto(base+'/place/butterfly',{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'查看地图',exact:true}).first().first().click();
  await mapReady();await shot('06-taoyuanyu-butterfly-markers.png');

  assert.equal(localWrites.length,0,localWrites.join('\n'));
  assert.equal(errors.length,0,errors.join('\n'));
  const report={passed:true,checkedAt:new Date().toISOString(),provider:'Tencent Maps JavaScript API GL',viewport:'390x844',screenshots:6,localWriteRequests:localWrites,consoleErrors:errors,note:'真实腾讯底图自动截图已通过，仍需实体 iPhone Safari 人工验收'};
  await writeFile(output+'/real-map-results.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await context.close();await browser.close();}

