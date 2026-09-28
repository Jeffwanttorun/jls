import { chromium } from "../../wuyishan-map-phase1/node_modules/@playwright/test/index.mjs";
import { writeFile } from "node:fs/promises";

const base=(process.env.SITE_URL||"http://127.0.0.1:4322").replace(/\/$/,"");
const checks=[];
const assert=(condition,message)=>{if(!condition)throw new Error(message);checks.push(message);};
const browser=await chromium.launch({channel:"msedge",headless:true});
try{
  for(const width of [320,375,390]){
    const context=await browser.newContext({viewport:{width,height:844},geolocation:{latitude:27.75,longitude:117.7},permissions:["geolocation"]});
    const page=await context.newPage();
    await page.goto(`${base}/zh/map?category=water`,{waitUntil:"networkidle"});
    await page.locator("[data-map-explorer]").waitFor();
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),`${width}px 中文地图无横向溢出`);
    assert(new URL(page.url()).searchParams.get("category")==="water",`${width}px 地图刷新保留 category`);
    await context.close();
  }

  const context=await browser.newContext({viewport:{width:390,height:844},geolocation:{latitude:27.75,longitude:117.7},permissions:["geolocation"]});
  const page=await context.newPage();
  await page.goto(`${base}/zh/map?category=water&place=WY-0009`,{waitUntil:"networkidle"});
  await page.locator("details.menu summary").click();
  const english=page.locator(".menu-language");
  assert((await english.getAttribute("href"))==="/map?category=water&place=WY-0009","中文到英文语言切换保留 category 与 place");
  await english.click();
  await page.waitForURL((url)=>url.pathname.replace(/\/$/,"")==="/map"&&url.searchParams.get("category")==="water"&&url.searchParams.get("place")==="WY-0009");
  await page.locator("details.menu summary").click();
  const chinese=page.locator(".menu-language");
  assert((await chinese.getAttribute("href"))==="/zh/map?category=water&place=WY-0009","英文到中文语言切换保留 category 与 place");

  await page.goto(`${base}/zh/map`,{waitUntil:"networkidle"});
  await page.getByRole("button",{name:"玩水",exact:true}).click();
  assert(new URL(page.url()).searchParams.get("category")==="water","地图筛选写入 URL state");
  await page.getByRole("button",{name:"风景",exact:true}).click();
  await page.goBack();
  assert(new URL(page.url()).searchParams.get("category")==="water","Back 恢复地图筛选状态");
  await page.goForward();
  assert(new URL(page.url()).searchParams.get("category")==="water,scenery","Forward 恢复地图筛选状态");
  await page.goto(`${base}/zh/map?category=tea-exhibitions`,{waitUntil:"networkidle"});
  assert((await page.getByRole("button",{name:"茶与展馆",exact:true}).getAttribute("aria-pressed"))==="true","旧分类链接映射到统一 canonical category");
  await page.getByRole("button",{name:"我的位置"}).click();
  await page.locator("[data-map-status]").getByText("已定位，蓝色圆点是你的位置",{exact:true}).waitFor();
  assert(await page.locator(".map-user-location").count()===1,"我的位置显示蓝色定位点");

  for(const locale of ["zh","en"]){
    await page.goto(`${base}/${locale==="zh"?"zh/":""}theme/food`,{waitUntil:"networkidle"});
    const empty=page.locator("[data-empty]");
    assert(!(await empty.isVisible()),`${locale} Theme 初始空状态不可见`);
    await page.locator("[data-theme-family-toggle]").check();
    assert(await empty.isVisible(),`${locale} Theme 零结果时显示空状态`);
    await page.locator("[data-theme-family-toggle]").uncheck();
    assert(!(await empty.isVisible()),`${locale} Theme 取消筛选后隐藏空状态`);
  }

  await page.goto(`${base}/zh/route/no-1-scenic-road`,{waitUntil:"networkidle"});
  const routeFilters=await page.locator(".route-map .map-filter-controls").innerText();
  assert(routeFilters.includes("筛选沿途地点")&&routeFilters.includes("茶与展馆")&&routeFilters.includes("床车过夜"),"Route 筛选使用中文统一标签");
  assert(!/(^|\s)(water|museum|camping)(\s|$)/.test(routeFilters),"Route 筛选不暴露内部 key");
  assert(!(await page.locator(".route-map .map-fallback ul").isVisible()),"41 点辅助清单默认折叠");
  assert((await page.locator(".stage-places a").first().locator("small").count())===1,"Route 地点卡不重复打印 role 与 category");

  await page.goto(`${base}/place/WY-0030`,{waitUntil:"networkidle"});
  const neighbors=await page.locator(".route-neighbors").innerText();
  assert(neighbors.includes("Next core stop")&&neighbors.includes("Black Tea Origins Exhibition Hall"),"英文 Next core stop 语义和目标正确");
  assert(!neighbors.includes("野猴观察区域"),"Nearby place 未进入 core-stop 导航");
  assert((await page.locator("[data-copy-name]").innerText())==="野猴谷","英文地点页保留可复制中文原名");
  assert(/\d+\.\d+,\s*\d+\.\d+/.test(await page.locator(".direction-reference small").innerText()),"英文地点页显示坐标");

  await page.goto(`${base}/zh/theme/camping`,{waitUntil:"networkidle"});
  const campingLinks=await page.locator(".dad-place-card").evaluateAll((nodes)=>nodes.map((node)=>node.getAttribute("href")));
  assert(!campingLinks.some((href)=>["WY-0002","WY-0003","WY-0052","WY-0053","WY-0057"].some((id)=>href?.includes(id))),"床车主题不再列出服务点和普通停车点");

  await page.goto(`${base}/theme/water`,{waitUntil:"networkidle"});
  assert(await page.locator(".dad-theme-title svg").count()===1&&!(await page.locator(".dad-theme-title").innerText()).includes("水"),"英文 Theme 使用语言中立 SVG 图标");

  await writeFile("reports/v4-browser-results.json",JSON.stringify({checkedAt:new Date().toISOString(),site:base,checks},null,2)+"\n");
  console.log(JSON.stringify({ok:true,site:base,checks:checks.length}));
}finally{await browser.close();}
