import { chromium } from "../../wuyishan-map-phase1/node_modules/@playwright/test/index.mjs";
import { writeFile } from "node:fs/promises";

const base=(process.env.SITE_URL||"http://127.0.0.1:4322").replace(/\/$/,"");
const checks=[];
const assert=(condition,message)=>{if(!condition)throw new Error(message);checks.push(message);};
const browser=await chromium.launch({channel:"msedge",headless:true});

try{
  for(const width of [320,375,390]){
    for(const [path,label] of [["/zh/theme/museum","只看亲子可去的地点"],["/theme/museum","Show places for families"]]){
      const context=await browser.newContext({viewport:{width,height:844}});
      const page=await context.newPage();
      await page.goto(`${base}${path}`,{waitUntil:"networkidle"});
      const filter=page.locator(".theme-family-filter");
      const textLabel=page.locator(".theme-family-filter-text");
      const checkbox=page.locator("[data-theme-family-toggle]");
      const metrics=await textLabel.evaluate((node)=>{
        const style=getComputedStyle(node);
        const rect=node.getBoundingClientRect();
        return {width:rect.width,height:rect.height,writingMode:style.writingMode,whiteSpace:style.whiteSpace};
      });
      const filterBox=await filter.boundingBox();
      const checkboxBox=await checkbox.boundingBox();
      assert(await textLabel.innerText()===label,`${width}px ${path} uses the intended family-filter copy`);
      assert(metrics.writingMode==="horizontal-tb",`${width}px ${path} family-filter text stays horizontal`);
      assert(metrics.width>70,`${width}px ${path} family-filter text is not constrained to a 19px icon box`);
      assert(metrics.height<58,`${width}px ${path} family-filter text keeps a normal mobile height`);
      assert(Boolean(filterBox&&filterBox.height>=40&&filterBox.height<90),`${width}px ${path} family filter remains a compact secondary control`);
      assert(Boolean(checkboxBox&&checkboxBox.width>=17&&checkboxBox.width<=19),`${width}px ${path} checkbox remains fixed near 18px`);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),`${width}px ${path} has no horizontal overflow`);
      await checkbox.focus();
      assert((await filter.evaluate((node)=>getComputedStyle(node).outlineStyle))!=="none",`${width}px ${path} keyboard focus remains visible`);
      await textLabel.click();
      assert(await checkbox.isChecked(),`${width}px ${path} the whole label toggles the family filter`);
      assert(new URL(page.url()).searchParams.get("kids")==="1",`${width}px ${path} family-filter state is preserved in the URL`);
      await context.close();
    }
  }

  const context=await browser.newContext({viewport:{width:390,height:844}});
  const page=await context.newPage();
  for(const [path,expected] of [["/",["Landscape","Tea","Culture","Nature"]],["/zh",["山水","茶","人文","自然"]]]){
    await page.goto(`${base}${path}`,{waitUntil:"networkidle"});
    assert(JSON.stringify(await page.locator(".heritage-grid h3").allTextContents())===JSON.stringify(expected),`${path} homepage chapter order is ${expected.join(" / ")}`);
  }
  for(const [path,expected] of [["/why-wuyishan",["Landscape","Tea","Culture","Nature"]],["/zh/why-wuyishan",["山水","茶","人文","自然"]]]){
    await page.goto(`${base}${path}`,{waitUntil:"networkidle"});
    assert(JSON.stringify(await page.locator(".why-chapter-heading h2").allTextContents())===JSON.stringify(expected),`${path} chapter order is ${expected.join(" / ")}`);
    assert(await page.locator("#people-and-ideas").evaluate((node)=>node.parentElement?.id)==="culture",`${path} old people-and-ideas hash resolves to Culture`);
    assert(await page.locator("#forest").evaluate((node)=>node.parentElement?.id)==="nature",`${path} old forest hash resolves to Nature`);
    for(const [hash,sectionId] of [["people-and-ideas","culture"],["forest","nature"]]){
      await page.goto("about:blank");
      await page.goto(`${base}${path}#${hash}`,{waitUntil:"networkidle"});
      const sectionPosition=await page.locator(`#${sectionId}`).evaluate((node)=>({top:node.getBoundingClientRect().top,viewport:innerHeight}));
      assert(sectionPosition.top>=-8&&sectionPosition.top<sectionPosition.viewport,`${path}#${hash} scrolls the ${sectionId} chapter into view (${JSON.stringify(sectionPosition)})`);
    }
  }

  await page.goto(`${base}/place/WY-0030`,{waitUntil:"networkidle"});
  const englishPlace=await page.locator("main").innerText();
  assert(englishPlace.includes("Chinese name for local search:"),"English place page gives a practical Chinese-name label");
  assert(!/(Working English translation|Pinyin|pending|中文原名)/i.test(englishPlace),"English place page hides internal translation workflow labels");
  assert((await page.locator(".place-back").innerText()).includes("Back to map"),"English place page uses Back to map");

  await page.goto(`${base}/zh/place/WY-0030`,{waitUntil:"networkidle"});
  assert((await page.locator(".place-back").innerText()).includes("返回地图"),"Chinese place page uses 返回地图");

  await page.goto(`${base}/zh/place/WY-0009`,{waitUntil:"networkidle"});
  assert((await page.locator("main").innerText()).includes("亲子信息"),"Conditional family place keeps a family section without requiring manual notes");

  await page.goto(`${base}/route/no-1-scenic-road`,{waitUntil:"networkidle"});
  const routeText=await page.locator("main").innerText();
  assert(routeText.includes("9 of 9 core stops checked in person"),"Route trust language is quantitative and core-stop based");
  assert(await page.locator("#no-1-scenic-road-map").count()===1,"Route map id is derived from the route slug");

  await page.goto(`${base}/theme/water`,{waitUntil:"networkidle"});
  assert((await page.locator(".dad-place-card img").evaluateAll((nodes)=>nodes.every((node)=>node.getAttribute("alt")===""))),"English theme card photos are decorative");

  await page.goto(`${base}/zh/theme/camping`,{waitUntil:"networkidle"});
  assert((await page.locator("main").innerText()).includes("过夜情况需确认"),"Camping theme localizes unknown overnight status cautiously");

  await writeFile("reports/v5-browser-results.json",JSON.stringify({checkedAt:new Date().toISOString(),site:base,checks},null,2)+"\n");
  console.log(JSON.stringify({ok:true,site:base,checks:checks.length}));
  await context.close();
}finally{
  await browser.close();
}
