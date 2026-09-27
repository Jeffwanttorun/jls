import { chromium } from "../../wuyishan-map-phase1/node_modules/@playwright/test/index.mjs";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const base = "http://127.0.0.1:4322";
const output = new URL("./dad-map-ui/", import.meta.url);
await mkdir(output, { recursive:true });
const browser = await chromium.launch({ channel:"msedge", headless:true });
const errors = [];
const checks = [];

try {
  for (const width of [360, 390]) {
    const context = await browser.newContext({ viewport:{ width, height:844 }, deviceScaleFactor:1 });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(`${width}: ${error.message}`));
    page.on("console", (message) => { if (message.type() === "error") errors.push(`${width}: ${message.text()}`); });
    for (const path of ["/zh", "/zh/explore-wuyishan", "/zh/why-wuyishan", "/zh/stories-of-wuyishan", "/zh/about", "/zh/map", "/zh/theme/water", "/zh/theme/scenery", "/zh/theme/nature", "/zh/theme/tea", "/zh/theme/museum", "/zh/theme/food", "/zh/place/WY-0009", "/zh/place/WY-0012", "/", "/why-wuyishan", "/explore-wuyishan", "/stories-of-wuyishan", "/about", "/map"]) {
      const response = await page.goto(base + path, { waitUntil:"networkidle" });
      assert.equal(response?.status(), 200, `${path} did not return 200`);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${path} overflows at ${width}px`);
      await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(250);
      assert.equal(await page.locator('img[src^="/"]').evaluateAll((images) => images.every((image) => image.complete && image.naturalWidth > 0)), true, `${path} has a broken local image`);
    }
    checks.push(`${width}px: 中文游客页、主题页和英文主要页面无横向溢出、图片均加载`);
    await context.close();
  }

  const context = await browser.newContext({ viewport:{ width:390, height:844 }, deviceScaleFactor:1 });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto(base + "/zh", { waitUntil:"networkidle" });
  assert.deepEqual(await page.locator(".heritage-section h3").allTextContents(), ["山水","茶","森林","人文"]);
  assert.equal(await page.locator('.dad-home-hero a[href="/zh/map"]').count(), 0, "Chinese homepage must not use the map as its primary content");
  assert.equal(await page.locator(".dad-map-brand strong").innerText(),"Local Dad Jeff","中文网站首页不应继续使用奶爸地图品牌标题");
  assert.match(await page.locator(".photo-hero img").getAttribute("src")||"",/wuyishan-river-hero\.jpg$/,"中文首页主视觉应与英文首页同步");
  const font = await page.locator("body").evaluate((node) => getComputedStyle(node).fontFamily);
  assert(/PingFang|Microsoft YaHei|Noto Sans CJK/.test(font), `unexpected Chinese font stack: ${font}`);
  await page.screenshot({ path:fileURLToPath(new URL("01-首页-390.png", output)), fullPage:true });
  checks.push("中文首页采用与英文一致的正式编辑版式，内容层级为山水、茶、森林、人文，而不是地图首页");

  for (const id of ["water","scenery","nature","tea","museum","food"]) {
    await page.goto(base + "/zh/explore-wuyishan", { waitUntil:"networkidle" });
    await page.locator(`.dad-theme-grid a[href^="/zh/theme/${id}"]`).click();
    assert(new URL(page.url()).pathname === `/zh/theme/${id}`);
    assert(await page.locator(".dad-place-card").count() > 0, `${id} theme has no cards`);
  }
  checks.push("探索页面的六个主题均可点击并进入有内容的独立结果页");

  await page.goto(base + "/zh/theme/water", { waitUntil:"networkidle" });
  const manshui = page.locator('.dad-place-card[href="/zh/place/WY-0009"]');
  assert.equal(await manshui.count(), 1, "漫水桥主题卡没有详情入口");
  await manshui.click();
  assert.equal(new URL(page.url()).pathname, "/zh/place/WY-0009");
  await page.locator("#place-map-WY-0009").scrollIntoViewIfNeeded();
  await page.waitForSelector("#place-map-WY-0009 .leaflet-marker-pane, #place-map-WY-0009 .leaflet-overlay-pane svg path");
  assert.equal(await page.getByRole("link",{name:"在地图上查看"}).count(),0,"地点详情不应再要求跳转后查看地图");
  const navigation=page.getByRole("button",{name:"导航",exact:true});
  assert.equal(await navigation.count(),1,"漫水桥详情缺少腾讯导航按钮");
  assert.match(await navigation.getAttribute("data-web-url")||"",/^https:\/\/map\.qq\.com\/nav\/drive#routes\/page\?/);
  await page.goto(base + "/zh/place/WY-0012", { waitUntil:"networkidle" });
  await page.locator("#place-map-WY-0012").scrollIntoViewIfNeeded();
  await page.waitForSelector("#place-map-WY-0012 .leaflet-overlay-pane svg path");
  assert.equal(await page.locator("#place-map-WY-0012 .leaflet-overlay-pane svg path").count(), 1, "单地点地图不应同时显示其他地点或路线");
  checks.push("主题卡可进入独立地点详情；详情直接显示单地点地图，并提供腾讯导航");

  await page.goto(base + "/zh/map", { waitUntil:"networkidle" });
  assert.equal(await page.locator(".dad-map-brand strong").innerText(),"武夷山奶爸","奶爸地图分支应保留自己的产品标题");
  assert.equal(await page.getByText("English map", { exact:true }).count(), 0, "中文奶爸地图不应显示英文地图切换");
  assert.equal(await page.locator(".menu-language").count(), 0, "中文奶爸地图菜单不应显示语言切换");
  const mapHeadingLayout = await page.locator(".public-map-block>header").evaluate((node) => {
    const style = getComputedStyle(node);
    return { position:style.position, height:node.getBoundingClientRect().height, display:style.display };
  });
  assert.equal(mapHeadingLayout.position, "static");
  assert(mapHeadingLayout.height < 360, `地图说明区高度异常：${mapHeadingLayout.height}`);
  assert.equal(await page.locator("footer.tool-footer").count(), 1, "奶爸地图应使用紧凑工具页脚");
  assert.equal(await page.locator("footer.tool-footer h2").count(), 0, "工具页脚不应继续显示大型编辑宣言");
  checks.push("中文奶爸地图移除英文切换，地图说明区不再继承顶部栏布局");

  await page.goto(base + "/zh/theme/water", { waitUntil:"networkidle" });
  await page.locator("[data-theme-family-toggle]").click();
  assert.equal(new URL(page.url()).searchParams.get("kids"), "1");
  assert.equal(await page.locator(".dad-place-card:not([hidden])").count(), 3);
  await page.screenshot({ path:fileURLToPath(new URL("02-玩水且适合带孩子-390.png", output)), fullPage:true });
  checks.push("适合带孩子筛选与玩水主题组合后保留3个匹配地点");

  await page.goto(base + "/zh/explore-wuyishan", { waitUntil:"networkidle" });
  await page.screenshot({ path:fileURLToPath(new URL("03-游客主题-390.png", output)), fullPage:true });
  await page.goto(base + "/zh/theme/nature", { waitUntil:"networkidle" });
  const taoyuanyuImage = await page.locator('.dad-place-card[href="/zh/place/WY-0024"] img').getAttribute("src");
  const butterflyImage = await page.locator('.dad-place-card[href="/zh/place/WY-0028"] img').getAttribute("src");
  assert(taoyuanyuImage && butterflyImage && taoyuanyuImage !== butterflyImage, "桃源峪与蝴蝶馆不得共用地点图片");
  await page.screenshot({ path:fileURLToPath(new URL("04-自然主题-390.png", output)), fullPage:true });
  checks.push("桃源峪与龙渡蝴蝶科普展示馆使用两个独立图片槽位和两张不同照片");
  await page.goto(base + "/", { waitUntil:"networkidle" });
  await page.screenshot({ path:fileURLToPath(new URL("05-English-home-390.png", output)), fullPage:true });
  assert.deepEqual(errors, []);
  checks.push("浏览器无脚本错误或控制台错误");
  await context.close();
  await writeFile(new URL("results.json", output), JSON.stringify({ passed:true, checkedAt:new Date().toISOString(), checks, errors }, null, 2));
  console.log(JSON.stringify({ passed:true, checks }, null, 2));
} finally {
  await browser.close();
}
