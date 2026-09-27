import {chromium,webkit} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';

const base=process.env.PROTOTYPE_BROWSER_URL||'https://127.0.0.1:5174';
const paths=['/','/corridor','/place/manshui','/place/tea','/place/butterfly','/place/xingcun','/theme/water','/theme/scenery','/theme/nature','/theme/museum','/theme/food','/theme/camping','/theme/tea','/theme/water?kids=1','/theme/nature?kids=1'];
const targets=[
  {name:'Microsoft Edge',launch:()=>chromium.launch({channel:'msedge',headless:true})},
  {name:'Chromium (Chrome engine)',launch:()=>chromium.launch({headless:true})},
  {name:'WebKit (Safari engine)',launch:()=>webkit.launch({headless:true})}
];
const results:any[]=[];

for(const target of targets){
  const browser=await target.launch();
  try{
    for(const viewport of [{width:390,height:844},{width:360,height:800}]){
      const context=await browser.newContext({viewport,ignoreHTTPSErrors:false});
      await context.addInitScript({path:'tests/tencent-sdk-stub.js'});
      let writes=0;
      await context.route('**/api/**',async route=>{
        if(!['GET','HEAD'].includes(route.request().method())){writes++;await route.abort();return;}
        await route.continue();
      });
      const page=await context.newPage();
      const errors:string[]=[];
      page.on('pageerror',error=>errors.push(error.message));
      for(const path of paths){
        await page.goto(base+path);
        await page.locator('h1:not(:empty)').first().waitFor();
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${target.name} ${viewport.width} ${path} 横向溢出`);
      }
      assert.equal(writes,0);
      assert.deepEqual(errors,[]);
      results.push({browser:target.name,viewport:`${viewport.width}x${viewport.height}`,pages:paths.length,horizontalOverflow:false,writeRequests:writes,pageErrors:errors});
      await context.close();
    }
  }finally{
    await browser.close();
  }
}

const result={passed:true,checkedAt:new Date().toISOString(),url:base,results};
await writeFile('reports/prototype-v0.2/compatibility-results.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
