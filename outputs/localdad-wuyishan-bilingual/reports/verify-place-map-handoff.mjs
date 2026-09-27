import { chromium } from "../../wuyishan-map-phase1/node_modules/@playwright/test/index.mjs";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const base="http://127.0.0.1:4322",output=new URL("./dad-map-ui/",import.meta.url);
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:"msedge",headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});
 await page.goto(`${base}/zh/place/WY-0009`,{waitUntil:"networkidle"});
 await page.locator("#place-map-WY-0009").scrollIntoViewIfNeeded();
 await page.waitForSelector("#place-map-WY-0009 .leaflet-overlay-pane svg path");
 assert.equal(await page.getByRole("link",{name:"在地图上查看"}).count(),0);
 assert.equal(await page.locator("#place-map-WY-0009 .leaflet-overlay-pane svg path").count(),1);
 const navigation=page.getByRole("button",{name:"导航",exact:true});
 assert.equal(await navigation.count(),1);
 assert.match(await navigation.getAttribute("data-web-url")||"",/^https:\/\/map\.qq\.com\/nav\/drive#routes\/page\?/);
 assert.match(await navigation.getAttribute("data-app-url")||"",/^qqmap:\/\/map\/routeplan\?/);
 await page.screenshot({path:fileURLToPath(new URL("06-漫水桥详情直接显示地图和导航-390.png",output)),fullPage:true});
 console.log(JSON.stringify({passed:true,place:"WY-0009",inlineSinglePlaceMap:true,tencentNavigation:true}));
}finally{await browser.close();}
