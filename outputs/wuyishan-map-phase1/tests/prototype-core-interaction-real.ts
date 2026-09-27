import {chromium,expect,type BrowserContext,type Page} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';

const base=process.env.PROTOTYPE_URL||'https://127.0.0.1:5174';
const output='reports/core-interaction-v0.2';
const screenshots=output+'/screenshots';
await mkdir(screenshots,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
const errors:string[]=[],checks:string[]=[];

const mapConfig=await (await fetch('http://127.0.0.1:3002/api/local-prototype/map-config')).json() as {key:string};
assert(mapConfig.key,'missing Tencent map key');
const glScript=await (await fetch('https://map.qq.com/api/gljs?'+new URLSearchParams({v:'1.exp',key:mapConfig.key,callback:'prototypeMapReady'}))).text();
assert(glScript.length>1_000_000,'Tencent map bootstrap script is incomplete');
async function usePrefetchedMapBootstrap(context:BrowserContext){
 await context.route(/^https:\/\/map\.qq\.com\/api\/gljs\?/,route=>route.fulfill({status:200,contentType:'application/javascript; charset=utf-8',body:glScript}));
}

async function ready(page:Page,scope:string,presentation:'none'|'background'|'primary'){
 const map=page.getByRole('dialog',{name:'游客地图'});await expect(map).toBeVisible();await expect(map).toHaveAttribute('data-map-scope',scope);await expect(map).toHaveAttribute('data-route-presentation',presentation);await expect(map.locator('.map-cover')).toHaveCount(0,{timeout:25000});await page.waitForTimeout(900);return map;
}

try{
 const context=await browser.newContext({viewport:{width:390,height:844},ignoreHTTPSErrors:true});await usePrefetchedMapBootstrap(context);const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error'&&!/ERR_ABORTED/.test(message.text()))errors.push(message.text());});

 await page.goto(base+'/theme/scenery');const qiyun=page.locator('.theme-place-card').filter({hasText:'齐云峰'});await qiyun.scrollIntoViewIfNeeded();await page.waitForTimeout(250);await page.screenshot({path:screenshots+'/01-齐云峰地点卡-导航与查看地图-390x844.png'});
 await qiyun.getByRole('button',{name:'查看地图',exact:true}).click();let map=await ready(page,'single-place','none');await expect(map).toHaveAttribute('data-selected-code','WY-0004');await expect(map.locator('.map-card')).toBeVisible();await page.screenshot({path:screenshots+'/02-齐云峰单地点-默认选中与底部卡-390x844.png'});checks.push('齐云峰单地点真实地图默认选中并自动显示底部卡，无路线');
 await map.getByRole('button',{name:'← 返回'}).click();const moon=page.locator('.theme-place-card').filter({hasText:'月亮湾'});await moon.scrollIntoViewIfNeeded();await page.waitForTimeout(250);await page.screenshot({path:screenshots+'/03-月亮湾地点卡-导航地图与禁止下水-390x844.png'});checks.push('齐云峰与月亮湾地点卡首层操作及提醒已截图');

 for(const [slug,label,file] of [['water','玩水','04-玩水主题-真实道路背景-390x844.png'],['nature','自然','05-自然主题-真实道路背景-390x844.png'],['tea','茶','06-茶主题-真实道路背景-390x844.png'],['museum','展馆','07-展馆主题-真实道路背景-390x844.png']] as const){await page.goto(base+'/theme/'+slug);await page.locator('.theme-hero').getByRole('button',{name:'查看地图',exact:true}).click();map=await ready(page,'theme','background');await expect(map.locator('.route-map-key')).toHaveCount(0);await expect(map.locator('.route-caption')).toHaveCount(0);await page.screenshot({path:screenshots+'/'+file});checks.push(label+'主题真实地图显示淡化道路背景且无大型路线浮层');}

 await page.goto(base+'/theme/scenery');await page.locator('.theme-place-card').filter({hasText:'齐云峰'}).getByRole('button',{name:'查看地图',exact:true}).click();map=await ready(page,'single-place','none');await map.getByRole('button',{name:'关闭地点卡'}).click();await expect(map.locator('.map-card')).toHaveCount(0);await page.screenshot({path:screenshots+'/08-齐云峰单地点-关闭卡后无主线-390x844.png'});checks.push('齐云峰关闭卡后地图可见，single-place仍无道路背景');

 await map.getByRole('button',{name:'← 返回'}).click();await page.goto(base+'/corridor');await page.getByRole('button',{name:'打开整条路线地图'}).click();map=await ready(page,'route','primary');await expect(map.locator('.route-map-key')).toBeVisible();await expect(map.locator('.route-caption')).toBeVisible();await page.screenshot({path:screenshots+'/09-一号风景道-完整路线模式-390x844.png'});checks.push('route mode真实地图继续显示完整路线、图例和起终点');

 await map.getByRole('button',{name:'← 返回'}).click();await page.goto(base+'/theme/scenery');await page.locator('.theme-place-card').filter({hasText:'齐云峰'}).getByRole('button',{name:'查看地图',exact:true}).click();map=await ready(page,'single-place','none');await expect(map.getByRole('button',{name:'导航到这里',exact:true})).toBeVisible();await expect(map.getByRole('button',{name:'查看详情',exact:true})).toBeVisible();await page.screenshot({path:screenshots+'/10-地图底部卡-导航与查看详情-390x844.png'});checks.push('地图底部卡真实截图包含导航与查看详情');
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await context.close();

 const narrow=await browser.newContext({viewport:{width:360,height:800},ignoreHTTPSErrors:true});await usePrefetchedMapBootstrap(narrow);const phone=await narrow.newPage();phone.on('pageerror',error=>errors.push(error.message));
 await phone.goto(base+'/theme/scenery');const q=phone.locator('.theme-place-card').filter({hasText:'齐云峰'});await q.scrollIntoViewIfNeeded();await phone.screenshot({path:screenshots+'/11-齐云峰地点卡-360x800.png'});assert(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await phone.goto(base+'/theme/water');await phone.locator('.theme-hero').getByRole('button',{name:'查看地图',exact:true}).click();await ready(phone,'theme','background');await phone.screenshot({path:screenshots+'/12-玩水主题道路背景-360x800.png'});assert(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await narrow.close();checks.push('360×800关键页面无横向溢出并完成真实地图截图');

 assert.deepEqual(errors,[]);const result={passed:true,checkedAt:new Date().toISOString(),provider:'Tencent Maps JavaScript API GL',viewports:['390x844','360x800'],screenshots:12,checks,consoleErrors:errors};await writeFile(output+'/real-map-results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await browser.close();}



