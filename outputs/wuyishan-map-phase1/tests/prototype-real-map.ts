import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';

const base=process.env.PROTOTYPE_BROWSER_URL||'https://127.0.0.1:5174';
const output='reports/prototype-v0.1';
const browser=await chromium.launch({channel:'msedge',headless:true});
const browserErrors:string[]=[];
const providerResponses:{url:string;status:number}[]=[];
let writes=0;
try{
  await mkdir(output+'/screenshots',{recursive:true});
  const context=await browser.newContext({viewport:{width:390,height:844},ignoreHTTPSErrors:false});
  await context.route('**/api/**',async route=>{
    if(!['GET','HEAD'].includes(route.request().method())){writes++;await route.abort();return;}
    await route.continue();
  });
  const page=await context.newPage();
  page.setDefaultTimeout(30000);
  page.on('pageerror',error=>browserErrors.push(error.message));
  page.on('console',message=>{if(message.type()==='error'&&!/ERR_ABORTED/.test(message.text()))browserErrors.push(message.text());});
  page.on('response',response=>{if(/(?:map\.qq\.com|mapgtimg\.com)/.test(response.url()))providerResponses.push({url:new URL(response.url()).hostname,status:response.status()});});
  await page.goto(base+'/');
  await page.getByRole('button',{name:'看地图',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'游客地图'})).toBeVisible();
  await page.waitForFunction(()=>Boolean((window as Window&{TMap?:unknown}).TMap&&document.querySelector('.map-canvas canvas')));
  await expect.poll(()=>providerResponses.filter(item=>item.status>=200&&item.status<400).length,{timeout:30000}).toBeGreaterThan(5);
  await page.waitForTimeout(2500);
  const provider=await page.evaluate(()=>({sdk:Boolean((window as Window&{TMap?:unknown}).TMap),canvases:document.querySelectorAll('.map-canvas canvas').length,technicalCopy:document.body.innerText.includes('测试环境：腾讯 SDK 事件替身')}));
  assert.equal(provider.sdk,true);
  assert(provider.canvases>0);
  assert.equal(provider.technicalCopy,false);
  assert.equal(writes,0);
  assert.deepEqual(browserErrors,[]);
  const runtimeErrors=[...browserErrors];
  const sensitivePath='/@fs/'+process.cwd().replaceAll('\\','/')+'/.env';
  const sensitiveStatus=await page.evaluate(async path=>(await fetch(path)).status,sensitivePath);
  assert.notEqual(sensitiveStatus,200);
  await page.screenshot({path:output+'/screenshots/real-tencent-map-390.png',fullPage:false});
  const result={passed:true,checkedAt:new Date().toISOString(),url:base,provider:'Tencent JavaScript API GL',sdkLoaded:provider.sdk,canvasCount:provider.canvases,successfulProviderResponses:providerResponses.filter(item=>item.status>=200&&item.status<400).length,providerHosts:[...new Set(providerResponses.map(item=>item.url))],writeRequests:writes,sensitiveFileRequestStatus:sensitiveStatus,browserErrors:runtimeErrors};
  await writeFile(output+'/real-map-results.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
}finally{await browser.close();}
