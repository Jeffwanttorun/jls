import { chromium } from "../../wuyishan-map-phase1/node_modules/@playwright/test/index.mjs";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const base = "http://127.0.0.1:4322";
const output = new URL("./why-chapters/", import.meta.url);
await mkdir(output, { recursive:true });

const expected = {
  "/why-wuyishan": ["Landscape", "Tea", "Forest", "People and Ideas"],
  "/zh/why-wuyishan": ["山水", "茶", "森林", "人文"],
};
const browser = await chromium.launch({ channel:"msedge", headless:true });
const results = [];
const errors = [];

try {
  for (const width of [360, 390]) {
    const context = await browser.newContext({ viewport:{ width, height:844 }, deviceScaleFactor:1 });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(`${width}px pageerror: ${error.message}`));
    page.on("console", (message) => { if (message.type() === "error") errors.push(`${width}px console: ${message.text()}`); });

    for (const [path, headings] of Object.entries(expected)) {
      const response = await page.goto(base + path, { waitUntil:"networkidle" });
      assert.equal(response?.status(), 200, `${path} did not return 200`);
      assert.deepEqual(await page.locator(".why-chapter-heading h2").allTextContents(), headings, `${path} chapter order differs`);
      assert.equal(await page.locator(".why-chapter").count(), 4, `${path} should have four chapters`);
      assert.equal(await page.locator(".why-chapter-cover img").count(), 4, `${path} should show one image for every chapter`);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${path} overflows at ${width}px`);
      const hrefs = await page.locator(".why-chapter-content nav a").evaluateAll((links) => links.map((link) => link.getAttribute("href")));
      for (const href of hrefs) {
        const linked = await page.request.get(base + href);
        assert.equal(linked.status(), 200, `${href} did not return 200`);
      }
      if (path === "/zh/why-wuyishan") {
        assert.equal(await page.locator('.why-map-branch a[href="/zh/map"]').count(), 1, "Dad Map must be a practical branch of Chinese Why Wuyishan");
        assert.equal(await page.locator('.why-chapter a[href="/zh/map"]').count(), 0, "Dad Map must not be presented as one of the four editorial chapters");
      }
      assert.equal(await page.locator('a[href*="zhu-xi-wuyishan-east-asia"]').count(), 0, "Zhu Xi draft must not be linked publicly");
      results.push(`${width}px ${path}: order, links, no overflow, draft isolation passed`);
    }

    await page.goto(base + "/why-wuyishan", { waitUntil:"networkidle" });
    await page.screenshot({ path:fileURLToPath(new URL(`why-en-${width}.png`, output)), fullPage:true });
    await page.goto(base + "/zh/why-wuyishan", { waitUntil:"networkidle" });
    await page.screenshot({ path:fileURLToPath(new URL(`why-zh-${width}.png`, output)), fullPage:true });
    await context.close();
  }

  const unpublished = await fetch(base + "/why-wuyishan/zhu-xi-wuyishan-east-asia", { redirect:"manual" });
  assert.equal(unpublished.status, 404, "Zhu Xi draft unexpectedly has a public page");
  assert.deepEqual(errors, []);
  const report = { passed:true, checkedAt:new Date().toISOString(), results, errors };
  await writeFile(new URL("results.json", output), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
