import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';

const base=process.env.PROTOTYPE_URL||'https://127.0.0.1:5174';
const output='reports/route-geometry-v0.2';
const views=[
  {file:'01-南源岭附近-390x844.png',label:'南源岭附近',start:0,end:24},
  {file:'02-星村至漫水桥-390x844.png',label:'星村—漫水桥',start:78,end:120},
  {file:'03-黄村至红星-390x844.png',label:'黄村—红星',start:126,end:201},
  {file:'04-月亮湾附近-390x844.png',label:'月亮湾附近',start:196,end:245},
  {file:'05-桃源峪至桐木方向-390x844.png',label:'桃源峪—桐木方向',start:510,end:690},
  {file:'06-大峡谷至坳头-390x844.png',label:'大峡谷—大竹岚—坳头',start:738,end:951}
];
const browser=await chromium.launch({channel:'msedge',headless:true});
const errors:string[]=[],providerRequests:string[]=[];
let writes=0;

try{
  await mkdir(output+'/screenshots',{recursive:true});
  const context=await browser.newContext({viewport:{width:390,height:844}});
  await context.route('**/api/**',async route=>{
    if(!['GET','HEAD'].includes(route.request().method())){writes++;await route.abort();return;}
    await route.continue();
  });
  const page=await context.newPage();
  page.setDefaultTimeout(20000);
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error'&&!/ERR_ABORTED/.test(message.text()))errors.push(message.text());});
  page.on('request',request=>{if(/map\.qq\.com/.test(request.url()))providerRequests.push(request.url());});
  await page.goto(base+'/');
  await page.getByRole('button',{name:'看地图',exact:true}).click();
  await page.locator('.map-canvas canvas').first().waitFor();

  for(const view of views){
    const result=await page.evaluate(async ({label,start,end})=>{
      // @ts-ignore Browser-side Vite module URL is resolved at runtime.
      const route=await import('/src/routeConfig.ts');
      const sdk=(window as any).TMap;
      const path=route.corridorGeometry.slice(start,end+1);
      document.body.innerHTML=`<main style="position:fixed;inset:0;padding:0;background:#eef2ee"><div id="road-map" style="position:absolute;inset:0"></div><header style="position:absolute;z-index:10004;top:12px;left:12px;right:12px;padding:13px 16px;border-radius:16px;background:rgba(255,255,255,.96);box-shadow:0 8px 24px rgba(20,50,39,.16);font:700 15px system-ui;color:#173c30;text-align:center">${label}<small style="display:block;margin-top:4px;color:#61736b;font-size:10px">腾讯地图实际道路 geometry 核验</small></header><aside style="position:absolute;z-index:10004;bottom:44px;left:12px;padding:8px 11px;border-radius:12px;background:rgba(255,255,255,.94);font:700 10px system-ui;color:#315448"><i style="display:inline-block;width:32px;height:6px;margin-right:8px;border-radius:9px;background:#176b4c;vertical-align:middle"></i>一号风景道主线</aside></main>`;
      const points=path.map((point:any)=>new sdk.LatLng(point.latitude,point.longitude));
      const map=new sdk.Map(document.querySelector('#road-map'),{center:points[Math.floor(points.length/2)],zoom:13,pitch:0,rotation:0});
      new sdk.MultiPolyline({map,styles:{road:new sdk.PolylineStyle({color:'rgba(23,107,76,.8)',width:6,borderWidth:1,borderColor:'rgba(255,255,255,.9)',lineCap:'round'})},geometries:[{id:'verified-road',styleId:'road',paths:points}]});
      const bounds=new sdk.LatLngBounds(points[0],points[0]);
      points.slice(1).forEach((point:any)=>bounds.extend(point));
      map.fitBounds(bounds,{padding:{top:100,right:28,bottom:90,left:28}});
      (window as any).__roadAuditMap=map;
      return {points:path.length};
    },view);
    assert(result.points>2);
    await page.waitForTimeout(1100);
    await page.screenshot({path:output+'/screenshots/'+view.file});
  }

  const full=await context.newPage();
  full.on('pageerror',error=>errors.push(error.message));
  full.on('console',message=>{if(message.type()==='error'&&!/ERR_ABORTED/.test(message.text()))errors.push(message.text());});
  await full.goto(base+'/corridor');
  await full.getByRole('button',{name:'打开整条路线地图',exact:true}).click();
  await expect(full.getByText('南源岭 → 坳头村 / 坳头观景台',{exact:true})).toBeVisible();
  await full.locator('.map-canvas canvas').first().waitFor();
  await full.waitForTimeout(1200);
  await full.screenshot({path:output+'/screenshots/07-完整路线视野-390x844.png'});

  assert.equal(writes,0);
  assert(providerRequests.length>0);
  assert.deepEqual(errors,[]);
  const result={passed:true,checkedAt:new Date().toISOString(),source:'Tencent driving route geometry cached in prototype config',views:views.map(view=>({label:view.label,file:view.file,geometryRange:[view.start,view.end]})),fullRoute:'07-完整路线视野-390x844.png',providerRequests:providerRequests.length,writeRequests:writes,consoleErrors:errors};
  await writeFile(output+'/real-road-browser.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
}finally{
  await browser.close();
}
