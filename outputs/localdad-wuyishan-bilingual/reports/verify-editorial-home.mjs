import { chromium } from "../../wuyishan-map-phase1/node_modules/@playwright/test/index.mjs";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const base = "http://127.0.0.1:4322";
const output = new URL("./editorial-home/", import.meta.url);
await mkdir(output, { recursive:true });
const browser = await chromium.launch({ channel:"msedge", headless:true });
const checks = [];
const errors = [];

try {
  for (const width of [390, 1024]) {
    const context = await browser.newContext({ viewport:{ width, height:width === 390 ? 844 : 768 }, deviceScaleFactor:1 });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(`${width}px: ${error.message}`));
    page.on("console", (message) => { if (message.type() === "error") errors.push(`${width}px: ${message.text()}`); });
    for (const [path, headings] of [["/", ["Landscape","Tea","Forest","People and Ideas"]], ["/zh", ["山水","茶","森林","人文"]]]) {
      const response = await page.goto(base + path, { waitUntil:"networkidle" });
      assert.equal(response?.status(), 200);
      assert.deepEqual(await page.locator(".heritage-grid h3").allTextContents(), headings);
      assert.equal(await page.locator(".photo-hero").count(), 1);
      assert.equal(await page.locator(".homepage-introduction").count(), 1);
      assert.equal(await page.locator(".homepage-paths").count(), 1);
      assert.equal(await page.locator(".homepage-stories").count(), 1);
      assert.equal(await page.locator(".homepage-about").count(), 1);
      assert(await page.locator("body").evaluate((node) => node.classList.contains("surface-editorial")));
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${path} overflows at ${width}px`);
      if (width === 1024) {
        const tops = await page.locator(".heritage-grid h3").evaluateAll((nodes) => nodes.map((node) => Math.round(node.getBoundingClientRect().top)));
        assert(Math.max(...tops) - Math.min(...tops) <= 2, `${path} chapter headings are not aligned: ${tops}`);
      }
      const header = page.locator(".dad-map-header");
      assert.equal(await header.evaluate((node) => node.classList.contains("is-scrolled")), false);
      await page.evaluate(() => window.scrollTo(0, 240));
      await page.waitForFunction(() => document.querySelector(".dad-map-header")?.classList.contains("is-scrolled"));
      const scrolledHeader = await header.evaluate((node) => {
        const style = getComputedStyle(node);
        return { radius:parseFloat(style.borderTopLeftRadius), width:node.getBoundingClientRect().width };
      });
      assert(scrolledHeader.radius > 20, `${path} scrolled header is still a hard rectangle`);
      assert(scrolledHeader.width < width, `${path} scrolled header does not separate softly from viewport edges`);
      await page.locator(".homepage-about").scrollIntoViewIfNeeded();
      await page.waitForFunction(() => {
        const image = document.querySelector(".homepage-about img");
        return image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0;
      });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path:fileURLToPath(new URL(`${path === "/" ? "en" : "zh"}-${width}.png`, output)), fullPage:true });
    }
    await context.close();
    checks.push(`${width}px: Chinese and English homepages share the same editorial structure without overflow`);
  }
  assert.deepEqual(errors, []);
  const report = { passed:true, checkedAt:new Date().toISOString(), checks, errors };
  await writeFile(new URL("results.json", output), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
