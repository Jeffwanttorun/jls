import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const base='https://127.0.0.1:5174',out='reports/map-context-v0.2/screenshots';
const browser=await chromium.launch({channel:'msedge',headless:true});
try{const page=await browser.newPage({viewport:{width:390,height:844},ignoreHTTPSErrors:true});page.setDefaultTimeout(15000);
 async function ready(){await expect(page.getByRole('dialog',{name:'游客地图'})).toBeVisible();await expect(page.locator('.map-cover')).toHaveCount(0);await page.waitForTimeout(1800);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 await page.goto(base+'/theme/scenery');await page.locator('.theme-place-card').filter({hasText:'齐云峰'}).getByRole('button',{name:'查看地图'}).click();await ready();assert.equal(await page.locator('.full-map').getAttribute('data-visible-codes'),'WY-0004');await page.screenshot({path:out+'/01-qiyun-single-place.png'});
 await page.goto(base+'/place/butterfly');await page.getByRole('button',{name:'查看地图',exact:true}).first().click();await ready();await page.screenshot({path:out+'/02-taoyuanyu-butterfly-content.png'});
 await page.goto(base+'/theme/nature');await page.locator('.theme-hero button.primary').click();await ready();await page.screenshot({path:out+'/03-nature-theme.png'});
 await page.goto(base+'/');await page.getByRole('button',{name:'看地图',exact:true}).click();await ready();await page.screenshot({path:out+'/04-all-places.png'});
 const result={passed:true,checkedAt:new Date().toISOString(),provider:'Tencent Maps JavaScript API GL',viewport:'390x844',screenshots:4};await writeFile('reports/map-context-v0.2/real-map-screenshots.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser.close();}

