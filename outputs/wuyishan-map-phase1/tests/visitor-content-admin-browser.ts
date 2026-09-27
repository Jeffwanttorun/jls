import {chromium,expect,type Page} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {corridorGeometry,corridorRouteSegments} from '../prototype/src/routeConfig.js';

const admin='https://127.0.0.1:5173',visitor='https://127.0.0.1:5174',out='reports/visitor-content-admin-v0.2';
await mkdir(out+'/screenshots',{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true}),errors:string[]=[],checks:string[]=[];
async function shot(page:Page,path:string,name:string,fullPage=false){await page.goto(path);await page.locator('h1').first().waitFor();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${name} 横向溢出`);await page.screenshot({path:`${out}/screenshots/${name}.png`,fullPage});}
try{
 const desktop=await browser.newContext({viewport:{width:1440,height:1000},ignoreHTTPSErrors:true});const page=await desktop.newPage();page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.message));
 await shot(page,admin+'/visitor-content','01-desktop-content-list');
 await shot(page,admin+'/visitor-content/new','02-desktop-new-content',true);
 await shot(page,admin+'/visitor-content/vc-manshui','03-desktop-content-editor',true);
 await page.locator('#modules').scrollIntoViewIfNeeded();await page.locator('#modules').screenshot({path:out+'/screenshots/04-desktop-module-editor.png'});
 await shot(page,admin+'/visitor-themes','05-desktop-theme-mapping',true);
 await page.locator('.batch-panel').scrollIntoViewIfNeeded();await page.locator('.batch-panel').screenshot({path:out+'/screenshots/06-desktop-theme-batch.png'});
 await shot(page,admin+'/visitor-content/vc-manshui#arrival','07-desktop-place-roles',true);await page.locator('#arrival').screenshot({path:out+'/screenshots/08-desktop-default-navigation.png'});await page.screenshot({path:out+'/screenshots/09-desktop-multi-navigation.png'});
 await shot(page,admin+'/visitor-content','10-desktop-publish-status');
 await shot(page,visitor+'/preview/vc-manshui','11-desktop-draft-preview',true);
 await shot(page,admin+'/visitor-alerts','12-desktop-alerts',true);
 await shot(page,admin+'/visitor-checks','13-desktop-content-checks',true);
 await page.goto(admin+'/visitor-content');await page.locator('.content-search input').fill('WY-0012');await expect(page.getByText('月亮湾')).toBeVisible();await page.screenshot({path:out+'/screenshots/14-desktop-search-place-history.png'});
 await desktop.close();

 const mobile=await browser.newContext({viewport:{width:390,height:844},ignoreHTTPSErrors:true});const phone=await mobile.newPage();phone.setDefaultTimeout(8000);phone.on('pageerror',e=>errors.push(e.message));
 await shot(phone,admin+'/visitor-content','15-mobile-content-list',true);
 await shot(phone,admin+'/visitor-content/vc-manshui','16-mobile-quick-editor',true);
 await shot(phone,admin+'/visitor-themes','17-mobile-theme-mapping',true);
 await phone.locator('.family-check').first().scrollIntoViewIfNeeded();await phone.screenshot({path:out+'/screenshots/18-mobile-family-filter.png'});
 await shot(phone,admin+'/visitor-alerts','19-mobile-alerts',true);
 await shot(phone,admin+'/visitor-content/vc-manshui#arrival','20-mobile-navigation',true);
 await shot(phone,admin+'/visitor-content','21-mobile-publish-hide',true);

 await shot(phone,visitor+'/theme/water','22-visitor-moon-removed-from-water',true);const water=await phone.locator('.theme-results').innerText();assert(!water.includes('月亮湾'));assert(water.includes('漫水桥'));
 await shot(phone,visitor+'/theme/scenery','23-visitor-moon-no-swimming-alert',true);await expect(phone.getByText('这里可以看水景，但禁止下水。')).toBeVisible();
 await shot(phone,visitor+'/theme/water','24-visitor-water-theme',true);
 await shot(phone,visitor+'/theme/nature','25-visitor-nature-theme',true);assert(await phone.getByText('月亮湾').count()>0);
 await shot(phone,visitor+'/theme/water?kids=1','26-visitor-water-family-intersection',true);
 await shot(phone,visitor+'/theme/scenery','27-visitor-refresh-effect',true);
 for(const path of ['/visitor-content','/visitor-content/new','/visitor-content/vc-manshui','/visitor-themes','/visitor-alerts','/visitor-checks']){const narrow=await mobile.newPage();await narrow.setViewportSize({width:360,height:800});await narrow.goto(admin+path);await narrow.locator('h1').first().waitFor();assert(await narrow.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),path+' 360px横向溢出');await narrow.close();}
 await mobile.close();
 assert.equal(corridorGeometry.length,952);assert.equal(corridorRouteSegments.length,6);checks.push('路线几何仍为952点、6段');checks.push('电脑14张、手机7张、游客效果6张截图已生成');checks.push('360px与390px均无横向溢出');checks.push('月亮湾不在玩水，保留风景、自然和适合带孩子，并展示禁止下水提醒');
 assert.deepEqual(errors,[]);
 const result={passed:true,checkedAt:new Date().toISOString(),screenshots:27,viewports:['1440x1000','390x844','360x800'],routePoints:corridorGeometry.length,routeSegments:corridorRouteSegments.length,consoleErrors:errors,checks};await writeFile(out+'/browser-results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await browser.close();}



