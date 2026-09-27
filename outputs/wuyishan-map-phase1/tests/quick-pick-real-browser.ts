import 'dotenv/config';import {chromium,expect} from '@playwright/test';import assert from 'node:assert/strict';import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'msedge',headless:true}),root='reports/phase2/quick-pick';const errors:string[]=[],checks:string[]=[];let writes=0;
const redact=(s:string)=>s.replaceAll(process.env.TENCENT_MAP_KEY||'__none__','[redacted]').replace(/([?&]key=)[^&\s]+/gi,'$1[redacted]');
try{
 await mkdir(root+'/screenshots',{recursive:true});const context=await browser.newContext({viewport:{width:1440,height:1100}});
 await context.route('**/api/**',async route=>{if(!['GET','HEAD'].includes(route.request().method())){writes++;await route.abort();}else await route.continue();});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(redact(e.message)));page.on('console',e=>{if(e.type()==='error')errors.push(redact(e.text()));});
 await page.goto('https://127.0.0.1:5173/places');const queue=await page.evaluate(async()=>await(await fetch('/api/admin/coordinate-queue')).json());assert(queue.next);
 await page.goto('https://127.0.0.1:5173/places/'+queue.next.code);
 await page.getByRole('heading',{name:'连续卫星判点',exact:true}).waitFor();assert(await page.evaluate(()=>isSecureContext));
 await expect(page.getByRole('button',{name:'卫星影像',exact:true})).toHaveAttribute('aria-pressed','true');await page.getByText('点选后自动保存候选',{exact:false}).waitFor();await page.waitForTimeout(6500);
 await expect(page.getByRole('button',{name:'确认此位置',exact:true})).toBeDisabled();assert.equal(await page.locator('.advanced-coordinates').getAttribute('open'),null);assert.equal(await page.getByRole('button',{name:'开始卫星判点',exact:true}).count(),0);
 await page.locator('.quick-picker').screenshot({path:root+'/screenshots/real-satellite-quick.png'});checks.push('可信HTTPS直接打开实际无坐标地点，真实腾讯卫星底图默认加载，高确定度和折叠高级操作');
 await page.getByRole('button',{name:'标准地图',exact:true}).click();await expect(page.getByRole('button',{name:'标准地图',exact:true})).toHaveAttribute('aria-pressed','true');await page.getByRole('button',{name:'卫星影像',exact:true}).click();checks.push('真实腾讯标准/卫星切换正常');
 await page.locator('.advanced-coordinates summary').click();await page.getByRole('button',{name:'采集当前位置',exact:true}).waitFor();await page.getByRole('region',{name:'历史坐标',exact:true}).waitFor();checks.push('实际详情高级操作可展开GPS、手工、来源和只读历史');
 assert.equal(writes,0);assert.deepEqual(errors,[]);
 await writeFile(root+'/real-browser.json',JSON.stringify({passed:true,checks,errors,writeRequests:writes,placeCode:queue.next.code,checkedAt:new Date().toISOString(),scope:'read-only real Tencent SDK and trusted HTTPS; no map picking or saving on real places'},null,2));console.log(JSON.stringify({passed:true,checks,writeRequests:writes},null,2));
}finally{await browser.close();}
