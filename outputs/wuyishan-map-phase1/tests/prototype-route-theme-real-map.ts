import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';

const base=process.env.PROTOTYPE_URL||'https://127.0.0.1:5174';
const output='reports/route-theme-v0.2';
const browser=await chromium.launch({channel:'msedge',headless:true});
const errors:string[]=[],requests:string[]=[];
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
  page.on('request',request=>{if(/map\.qq\.com|vectorsdk\.map\.qq\.com/.test(request.url()))requests.push(request.url());});

  await page.goto(base+'/');
  await page.getByRole('button',{name:'看地图',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'游客地图'})).toBeVisible();
  await page.locator('.full-map canvas').first().waitFor();
  await expect(page.getByText('一号风景道 · 南源岭至坳头村',{exact:true})).toBeVisible();
  await page.waitForTimeout(900);
  await page.screenshot({path:output+'/screenshots/01-all-places-map-route-390x844.png'});

  await page.getByRole('button',{name:'一号风景道',exact:true}).click();
  await expect(page.getByText('南源岭 → 坳头村 / 坳头观景台',{exact:true})).toBeVisible();
  await page.waitForTimeout(1100);
  await page.screenshot({path:output+'/screenshots/02-corridor-mode-390x844.png'});

  await page.goto(base+'/theme/water');
  await expect(page.locator('.theme-place-card')).toHaveCount(7);
  await page.locator('.theme-map-card canvas').first().waitFor();
  await page.waitForTimeout(700);
  await page.screenshot({path:output+'/screenshots/03-water-theme-390x844.png'});

  await page.goto(base+'/theme/nature?kids=1');
  await expect(page.locator('.theme-place-card')).toHaveCount(5);
  await page.locator('.theme-map-card canvas').first().waitFor();
  await page.waitForTimeout(700);
  await page.screenshot({path:output+'/screenshots/04-nature-kids-theme-390x844.png'});

  await page.goto(base+'/theme/water');
  const moon=page.locator('.theme-place-card').filter({hasText:'月亮湾'});
  await moon.scrollIntoViewIfNeeded();
  await expect(moon.getByText('玩水',{exact:true})).toBeVisible();
  await expect(moon.getByText('风景',{exact:true})).toBeVisible();
  await expect(moon.getByText('适合带孩子',{exact:true})).toBeVisible();
  await page.waitForTimeout(250);
  await page.screenshot({path:output+'/screenshots/05-one-place-two-themes-390x844.png'});

  await page.goto(base+'/corridor');
  await page.getByRole('button',{name:'打开整条路线地图',exact:true}).click();
  await expect(page.getByText('南源岭 → 坳头村 / 坳头观景台',{exact:true})).toBeVisible();
  await page.locator('.full-map canvas').first().waitFor();
  await page.waitForTimeout(1100);
  await page.screenshot({path:output+'/screenshots/06-nanyuanling-to-aotou-full-route-390x844.png'});

  assert.equal(writes,0);
  assert(requests.length>0);
  assert.deepEqual(errors,[]);
  const result={passed:true,checkedAt:new Date().toISOString(),base,viewport:'390x844',screenshots:6,tencentRequests:requests.length,writeRequests:writes,consoleErrors:errors};
  await writeFile(output+'/real-map-results.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
}finally{
  await browser.close();
}
