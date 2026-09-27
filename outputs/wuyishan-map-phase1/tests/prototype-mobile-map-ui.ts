import {chromium,expect,type Browser,type Page} from '@playwright/test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import vue from '@vitejs/plugin-vue';
import {mkdir,writeFile} from 'node:fs/promises';

const output='reports/mobile-map-ui-v0.2',base='http://127.0.0.1:5191';
await mkdir(output+'/screenshots',{recursive:true});
let browser:Browser|undefined,vite:any;
const results:any[]=[];

async function markerBounds(page:Page,styleId:string){
  return page.evaluate(async id=>{
    const style=(window as any).__mapTest.markerStyles[id];
    const symbol=decodeURIComponent(style.src).includes('data-symbol="baby-bottle"');
    const image=new Image();image.src=style.src;await image.decode();
    const canvas=document.createElement('canvas');canvas.width=style.width;canvas.height=style.height;
    const context=canvas.getContext('2d')!;context.drawImage(image,0,0,style.width,style.height);
    const pixels=context.getImageData(0,0,style.width,style.height).data;
    let minX=style.width,minY=style.height,maxX=-1,maxY=-1;
    for(let y=0;y<style.height;y++)for(let x=0;x<style.width;x++)if(pixels[(y*style.width+x)*4+3]>8){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
    return {width:style.width,height:style.height,anchor:style.anchor,minX,minY,maxX,maxY,symbol};
  },styleId);
}

async function runViewport(width:number,height:number){
  const context=await browser!.newContext({viewport:{width,height}});
  await context.addInitScript({path:'tests/tencent-sdk-stub.js'});
  const page=await context.newPage(),errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{const url=message.location().url;if(message.type()==='error'&&!url.endsWith('/favicon.ico'))errors.push(message.text()+' @ '+url);});
  await page.goto(base+'/theme/scenery');
  await page.locator('.theme-place-card').filter({hasText:'齐云峰'}).getByRole('button',{name:'查看地图'}).click();
  await expect(page.getByRole('dialog',{name:'游客地图'})).toBeVisible();
  const viewport=await page.evaluate(()=>({innerHeight,visualHeight:visualViewport?.height||innerHeight,scrollWidth:document.documentElement.scrollWidth}));
  const overlay=await page.locator('.full-map').boundingBox();
  assert(overlay);assert(Math.abs(overlay.height-viewport.visualHeight)<=1);assert(viewport.scrollWidth<=width);

  for(const styleId of ['core','service','focus','muted']){
    const marker=await markerBounds(page,styleId);
    assert(marker.minX>=3&&marker.minY>=3,styleId+' marker must have top/left safety space');
    assert(marker.maxX<=marker.width-4&&marker.maxY<=marker.height-4,styleId+' marker must have right/bottom safety space');
    assert(Math.abs(marker.anchor.x-(marker.width/2))<.1,styleId+' marker anchor must be horizontally centered');
    assert(Math.abs(marker.anchor.y-marker.maxY)<=1,styleId+' coordinate anchor must meet the rendered pin tip');
    assert(marker.symbol,styleId+' marker must use the baby-bottle symbol');
  }

  await page.evaluate(()=>(window as any).__mapTest.marker.handlers.click({geometry:{id:'WY-0004'}}));
  const sheet=page.locator('.map-card');await expect(sheet).toBeVisible();await expect(sheet).toHaveAttribute('data-sheet-state','default');
  const firstSheet=await sheet.boundingBox(),map=await page.locator('.full-map .map-canvas').boundingBox();assert(firstSheet&&map);
  assert(firstSheet.y>map.y+map.height*.5,'default sheet must leave most of the map visible');
  const nav=await sheet.getByRole('button',{name:'导航到这里'}).boundingBox();assert(nav&&nav.y+nav.height<=viewport.visualHeight);
  const scroll=page.locator('.map-card-scroll');const scrollData=await scroll.evaluate(el=>({clientHeight:el.clientHeight,scrollHeight:el.scrollHeight,overflow:getComputedStyle(el).overflowY,touchAction:getComputedStyle(el).touchAction}));
  assert(scrollData.scrollHeight>scrollData.clientHeight);assert.equal(scrollData.overflow,'auto');assert.equal(scrollData.touchAction,'pan-y');
  await sheet.getByRole('button',{name:'展开地点详情'}).click();await expect(sheet).toHaveAttribute('data-sheet-state','expanded');await page.waitForTimeout(300);
  const expanded=await sheet.boundingBox();assert(expanded&&expanded.height>firstSheet.height);assert(expanded.y>=90);
  await scroll.evaluate(el=>el.scrollTop=el.scrollHeight);
  const end=await page.locator('.map-sheet-safe-end').boundingBox(),scrollBox=await scroll.boundingBox();assert(end&&scrollBox);assert(end.y+end.height<=scrollBox.y+scrollBox.height+1);
  await sheet.getByRole('button',{name:'关闭地点卡'}).click();
  await expect(sheet).toHaveCount(0);assert.equal(await page.locator('.full-map').count(),1);
  const stateChecks:string[]=[];
  const styles=():Promise<string[]>=>page.evaluate(()=>(window as any).__mapTest.geometries.map((item:any)=>item.styleId));
  assert.deepEqual(await styles(),['focus']);stateChecks.push('单地点及选中地点使用完整 focus marker');
  if(width===390){
    await page.getByRole('button',{name:'← 返回'}).click();
    await page.goto(base+'/');await page.getByRole('button',{name:'看地图',exact:true}).click();await expect(page.getByRole('dialog',{name:'游客地图'})).toBeVisible();
    assert((await styles()).includes('core'));assert((await styles()).includes('service'));stateChecks.push('全部地点包含普通和服务 marker');
    await page.getByRole('button',{name:'← 返回'}).click();
    await page.goto(base+'/place/butterfly');await page.getByRole('button',{name:'查看地图',exact:true}).first().click();await expect(page.getByRole('dialog',{name:'游客地图'})).toBeVisible();
    assert((await styles()).includes('focus'));assert((await styles()).includes('service'));stateChecks.push('组合内容包含主要和弱化服务 marker');
    await page.getByRole('button',{name:'← 返回'}).click();
    await page.goto(base+'/theme/nature');await page.locator('.theme-hero button.primary').click();await expect(page.getByRole('dialog',{name:'游客地图'})).toBeVisible();
    assert((await styles()).includes('focus'));assert((await styles()).every(style=>style==='focus'||style==='service'));stateChecks.push('主题地图使用完整 focus marker，并弱化服务点');
    await page.getByRole('button',{name:'← 返回'}).click();
    await page.goto(base+'/corridor');await page.getByRole('button',{name:'打开整条路线地图'}).click();await expect(page.getByRole('dialog',{name:'游客地图'})).toBeVisible();
    assert((await styles()).includes('routeStart'));assert((await styles()).includes('routeEnd'));assert((await styles()).includes('focus'));
    await page.evaluate(()=>(window as any).__mapTest.maps.at(-1).setZoom(14));assert((await styles()).includes('service'));stateChecks.push('一号风景道起终点、普通及缩放后服务 marker 正常');
  }
  assert.equal(errors.length,0,errors.join('\n'));
  results.push({viewport:`${width}x${height}`,overlayHeight:overlay.height,visualViewportHeight:viewport.visualHeight,scroll:scrollData,markerStyles:await Promise.all(['core','service','focus','muted'].map(id=>markerBounds(page,id))),stateChecks,consoleErrors:errors});
  await context.close();
}

try{
  vite=await createServer({configFile:false,root:'prototype',cacheDir:'../node_modules/.vite-mobile-map-ui',plugins:[vue()],server:{host:'127.0.0.1',port:5191,strictPort:true,proxy:{'/api/local-prototype':'http://127.0.0.1:3002'}}});
  await vite.listen();browser=await chromium.launch({channel:'msedge',headless:true});
  await runViewport(360,800);await runViewport(390,844);
  const report={passed:true,checkedAt:new Date().toISOString(),note:'自动化不能替代实体 iPhone Safari 人工验收',results};
  await writeFile(output+'/browser-results.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser?.close();await vite?.close();}

