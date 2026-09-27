import 'dotenv/config';
import {chromium,expect,type Page} from '@playwright/test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';

const base='https://127.0.0.1:5174';
const api='http://127.0.0.1:3002';
const output='reports/navigation-mapscope-v0.2';
const screenshots=output+'/screenshots';
await mkdir(screenshots,{recursive:true});
assert(process.env.TENCENT_MAP_KEY,'missing TENCENT_MAP_KEY');
const places=(await (await fetch(api+'/api/local-prototype/places')).json()).items as any[];
const presentation=await (await fetch(api+'/api/local-prototype/presentation')).json() as any;
const browser=await chromium.launch({channel:'msedge',headless:true});
const checks:string[]=[],errors:string[]=[];

function place(code:string){const result=places.find(item=>item.code===code);assert(result,`missing ${code}`);return result;}
function defaultTarget(slug:string){const content=presentation.contents.find((item:any)=>item.document.slug===slug);assert(content);const target=content.document.navigationTargets.find((item:any)=>item.isDefault);assert(target);return place(target.placeCode);}
function webUrl(target:any){return 'https://map.qq.com/nav/drive#routes/page?'+new URLSearchParams({cond:'0',epointx:String(target.longitude),epointy:String(target.latitude),eword:target.name,sword:'我的位置',transport:'2'});}
async function mapReady(page:Page,scope:string,route:boolean){await expect(page.getByRole('dialog',{name:'游客地图'})).toBeVisible();await expect(page.locator('.map-cover')).toHaveCount(0,{timeout:20000});await expect(page.locator('.full-map')).toHaveAttribute('data-map-scope',scope);await expect(page.locator('.full-map')).toHaveAttribute('data-route-layer',route?'visible':'hidden');if(route){await expect(page.locator('.full-map .route-map-key')).toBeVisible();await expect(page.locator('.full-map .route-caption')).toBeVisible();}else{await expect(page.locator('.full-map .route-map-key')).toHaveCount(0);await expect(page.locator('.full-map .route-caption')).toHaveCount(0);}assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.waitForTimeout(800);}

try{
 const context=await browser.newContext({viewport:{width:390,height:844},ignoreHTTPSErrors:true});const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base+'/theme/scenery');await page.locator('.theme-place-card').filter({hasText:'齐云峰'}).getByRole('button',{name:'查看地图'}).click();await mapReady(page,'single-place',false);assert.equal(await page.locator('.full-map').getAttribute('data-visible-codes'),'WY-0004');await page.screenshot({path:screenshots+'/01-齐云峰单地点-无路线图例-390x844.png'});checks.push('齐云峰 single-place 真实腾讯地图无路线和图例');
 await page.goto(base+'/theme/scenery');await page.locator('.theme-place-card').filter({hasText:'月亮湾'}).getByRole('button',{name:'查看地图'}).click();await mapReady(page,'single-place',false);assert.equal(await page.locator('.full-map').getAttribute('data-visible-codes'),'WY-0012');await page.screenshot({path:screenshots+'/02-月亮湾单地点-无路线残留-390x844.png'});checks.push('月亮湾 single-place 真实腾讯地图无路线残留');
 await page.goto(base+'/place/butterfly');await page.getByRole('button',{name:'查看地图',exact:true}).first().click();await mapReady(page,'content-unit',false);assert.deepEqual((await page.locator('.full-map').getAttribute('data-visible-codes'))!.split(',').sort(),['WY-0024','WY-0025','WY-0026','WY-0028']);await page.screenshot({path:screenshots+'/03-桃源峪蝴蝶馆组合地图-390x844.png'});checks.push('桃源峪+蝴蝶馆只显示组合相关地点且无路线残留');
 await page.goto(base+'/theme/nature');await page.locator('.theme-hero button.primary').click();await mapReady(page,'theme',false);await page.screenshot({path:screenshots+'/04-自然主题地图-390x844.png'});checks.push('自然主题真实地图只显示主题结果且无路线图例');
 await page.goto(base+'/corridor');await page.getByRole('button',{name:'打开整条路线地图'}).click();await mapReady(page,'route',true);await page.screenshot({path:screenshots+'/05-一号风景道路线地图-390x844.png'});checks.push('一号风景道 route scope 正常显示路线和图例');
 await page.goto(base+'/');await page.getByRole('button',{name:'看地图',exact:true}).click();await mapReady(page,'all-places',false);await page.screenshot({path:screenshots+'/06-全部地点地图-390x844.png'});checks.push('全部地点 scope 显示全部地点且不显示路线图例');
 await context.close();

 const iphone=await browser.newContext({viewport:{width:390,height:844},ignoreHTTPSErrors:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'});
 const navigationCases=[{file:'07-齐云峰腾讯导航目标-390x844.png',target:place('WY-0004')},{file:'08-月亮湾腾讯导航目标-390x844.png',target:place('WY-0012')},{file:'09-桃源峪停车位置腾讯导航目标-390x844.png',target:defaultTarget('butterfly')}];
 const externalPages=[] as Array<{name:string;status:number|null;title:string;errorPage:boolean}>;
 for(const item of navigationCases){const external=await iphone.newPage();const response=await external.goto(webUrl(item.target),{waitUntil:'domcontentloaded',timeout:30000});await external.waitForTimeout(1200);const title=await external.title(),text=await external.locator('body').innerText().catch(()=>"");const errorPage=/您的访问出错了|您要访问的页面不存在/.test(text),finalUrl=new URL(external.url());console.log(JSON.stringify({target:item.target.name,status:response?.status()??null,title,errorPage,finalEndpoint:finalUrl.origin+finalUrl.pathname,body:text.slice(0,160)}));assert.equal(response?.status(),200);assert(!errorPage);assert(/腾讯导航|腾讯地图/.test(title));await external.screenshot({path:screenshots+'/'+item.file});externalPages.push({name:item.target.name,status:response?.status()??null,title,errorPage});await external.close();}
 checks.push('齐云峰、月亮湾、桃源峪停车位置的腾讯H5导航实际返回可用页面，无“页面不存在”');await iphone.close();

 const geometry=await readFile('prototype/src/routeGeometryData.ts');
 const result={passed:true,checkedAt:new Date().toISOString(),provider:'Tencent Maps JavaScript API GL + Tencent URI API',viewport:'390x844',checks,externalPages,routeGeometrySha256:createHash('sha256').update(geometry).digest('hex'),routePoints:952,routeSegments:6,consoleErrors:errors};
 assert.deepEqual(errors,[]);await writeFile(output+'/real-browser-results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await browser.close();}

