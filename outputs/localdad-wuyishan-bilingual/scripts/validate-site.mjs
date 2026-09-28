import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { productionSiteUrl } from "../site.config.mjs";

const root = fileURLToPath(new URL("../dist/", import.meta.url));
const isHostedPreview = process.env.VERCEL_ENV === "preview";
if (!existsSync(root)) throw new Error("dist/ is missing. Run the Astro build first.");

const files = [];
function walk(directory) {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) walk(path);
    else files.push(path);
  }
}
walk(root);

const htmlFiles = files.filter((file) => extname(file) === ".html");
const errors = [];
const titles = new Map();
const descriptions = new Map();
const canonicals = new Map();
let maxInlineClientJsBytes = 0;

for (const file of files) {
  const label = relative(root, file);
  if (label.startsWith("draft-preview/") && !isHostedPreview) errors.push(`${label}: development-only draft preview was generated in production`);
}

function pageExists(pathname) {
  const clean = pathname.replace(/\/$/, "");
  if (!clean) return existsSync(join(root, "index.html"));
  return existsSync(join(root, `${clean}.html`)) || existsSync(join(root, clean, "index.html"));
}

for (const file of htmlFiles) {
  const html = readFileSync(file, "utf8");
  const label = relative(root, file);
  const isDraftPreview = label.startsWith("draft-preview/");
  const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
  const description = html.match(/<meta name="description" content="([^"]+)"/)?.[1];
  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
  const h1Count = (html.match(/<h1(?:\s|>)/g) || []).length;
  const inlineBytes = [...html.matchAll(/<script(?![^>]*type="application\/ld\+json")[^>]*>([\s\S]*?)<\/script>/g)].reduce((total, script) => total + Buffer.byteLength(script[1]), 0);
  maxInlineClientJsBytes = Math.max(maxInlineClientJsBytes, inlineBytes);
  if ((html.includes("Draft preview") || html.includes("Draft Preview")) && !isDraftPreview) errors.push(`${label}: draft preview status is exposed outside a preview page`);
  if (isDraftPreview && !/<meta name="robots" content="[^"]*noindex[^"]*"/.test(html)) errors.push(`${label}: hosted draft preview must be noindex`);

  if (!title) errors.push(`${label}: missing title`);
  if (!description) errors.push(`${label}: missing meta description`);
  if (title && title.length > 70 && !isDraftPreview) errors.push(`${label}: title is longer than 70 characters`);
  if (description && (description.length < 50 || description.length > 170)) errors.push(`${label}: meta description should be 50–170 characters`);
  if (!canonical) errors.push(`${label}: missing canonical URL`);
  if (!/<meta property="og:image" content="https?:\/\/[^\"]+"/.test(html)) errors.push(`${label}: missing absolute Open Graph image`);
  if (!/<meta property="og:image:alt" content="[^\"]+"/.test(html)) errors.push(`${label}: missing Open Graph image alt text`);
  if (!/<meta name="twitter:image:alt" content="[^\"]+"/.test(html)) errors.push(`${label}: missing social image alt text`);
  if (!/<html lang="[^"]+"/.test(html)) errors.push(`${label}: missing HTML language`);
  if (!/<a class="skip" href="#content">/.test(html)) errors.push(`${label}: missing skip link`);
  if (!/<main id="content">/.test(html)) errors.push(`${label}: missing main landmark`);
  if (!html.includes(`<meta property="og:url" content="${productionSiteUrl}/`)) errors.push(`${label}: Open Graph URL is not production`);
  if (canonical && !canonical.startsWith(`${productionSiteUrl}/`)) errors.push(`${label}: canonical URL is not production`);
  if (h1Count !== 1) errors.push(`${label}: expected one H1, found ${h1Count}`);
  if (title) {
    if (titles.has(title) && title !== "Page Not Found | Local Dad Jeff in Wuyishan") errors.push(`${label}: duplicate title with ${titles.get(title)}`);
    titles.set(title, label);
  }
  if (description) {
    if (descriptions.has(description)) errors.push(`${label}: duplicate description with ${descriptions.get(description)}`);
    descriptions.set(description, label);
  }
  if (canonical) {
    if (canonicals.has(canonical)) errors.push(`${label}: duplicate canonical URL with ${canonicals.get(canonical)}`);
    canonicals.set(canonical, label);
  }

  for (const script of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { JSON.parse(script[1]); }
    catch { errors.push(`${label}: invalid JSON-LD`); }
  }

  for (const image of html.matchAll(/<img\s+[^>]*>/g)) {
    const tag = image[0];
    if (!/\bwidth="\d+"/.test(tag) || !/\bheight="\d+"/.test(tag)) errors.push(`${label}: image is missing dimensions`);
    if (!/\balt="[^"]*"/.test(tag)) errors.push(`${label}: image is missing alt text`);
  }

  for (const link of html.matchAll(/href="([^"]+)"/g)) {
    const href = link[1];
    if (!href.startsWith("/") || href.startsWith("//")) continue;
    const pathname = href.split("#")[0].split("?")[0];
    if (!pathname || extname(pathname)) continue;
    if (!pageExists(pathname)) errors.push(`${label}: broken internal link ${href}`);
  }
}

const clientJsBytes = files.filter((file) => extname(file) === ".js").reduce((total, file) => total + statSync(file).size, 0);
for (const required of ["robots.txt", "sitemap-index.xml", "site.webmanifest"]) {
  if (!existsSync(join(root, required))) errors.push(`missing generated ${required}`);
}
if (existsSync(join(root, "robots.txt"))) {
  const robots = readFileSync(join(root, "robots.txt"), "utf8");
  if (!robots.includes(`Sitemap: ${productionSiteUrl}/sitemap-index.xml`)) errors.push("robots.txt: missing production sitemap URL");
}
for (const sitemapFile of files.filter((file) => /^sitemap.*\.xml$/.test(relative(root, file)))) {
  if (readFileSync(sitemapFile, "utf8").includes("/draft-preview/")) errors.push(`${relative(root, sitemapFile)}: draft preview URL is present in the sitemap`);
}

function requireBuiltContent(pathname,required=[],forbidden=[]){
  const file=join(root,...pathname.split("/"),"index.html");
  if(!existsSync(file)){errors.push(`${pathname}: expected built page is missing`);return;}
  const html=readFileSync(file,"utf8");
  for(const value of required)if(!html.includes(value))errors.push(`${pathname}: missing required knowledge-map content ${value}`);
  for(const value of forbidden)if(html.includes(value))errors.push(`${pathname}: obsolete or invalid knowledge-map content ${value}`);
}

requireBuiltContent("zh/explore-wuyishan",["打开地图","实地路线","/zh/route/no-1-scenic-road","按兴趣找地方"],["带娃怎么玩","一天怎么玩","两天怎么玩"]);
requireBuiltContent("explore-wuyishan",["Wuyishan Map","Open the Map","No. 1 Scenic Road","Explore by Interest","Main Scenic Area"]);
requireBuiltContent("zh/theme/water",["/zh/map?category=water","data-empty hidden"]);
requireBuiltContent("theme/water",["/map?category=water","View on Map","Family-friendly"]);
requireBuiltContent("map",["Black Tea Hall","Nanyuanling Parking","\"filterIds\":[\"scenery\"]"],["Nanyuanling南源岭"]);
requireBuiltContent("zh/map",["红茶馆","\"filterIds\":[\"scenery\"]"]);
requireBuiltContent("route/no-1-scenic-road",["9 core stops · 41 mapped places","stage-support","Services and junctions","Nanyuanling","南源岭"],["Nanyuanling南源岭"]);
requireBuiltContent("zh/route/no-1-scenic-road",["9 个核心停留点 · 41 个已记录地图点","实地核验"]);
requireBuiltContent("place/WY-0030",["Tongmu Area","中文原名：野猴谷"]);
requireBuiltContent("place/WY-0032",["Previous: Wild Monkey Valley","Next: Grand Canyon Exhibition Hall"]);
requireBuiltContent("place/WY-0002",["Nanyuanling Parking","Nearby services"],["Continue along the route"]);
if (errors.length) throw new Error(`Site validation failed:\n${errors.map((error) => `- ${error}`).join("\n")}`);
console.log(`Validated ${htmlFiles.length} HTML files; JavaScript files: ${clientJsBytes} bytes; max inline script per page: ${maxInlineClientJsBytes} bytes.`);
