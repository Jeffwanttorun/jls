import 'dotenv/config';
import {chromium,devices,expect} from '@playwright/test';import assert from 'node:assert/strict';import pg from 'pg';import {randomUUID} from 'node:crypto';import {mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';import vue from '@vitejs/plugin-vue';import {createApp} from '../backend/src/app.js';import {addCandidate,confirmCandidate} from '../backend/src/coordinates.js';
const admin=new pg.Pool({connectionString:process.env.DATABASE_URL}),name=`wymap_test_${randomUUID().replaceAll('-','')}`;
await admin.query(`CREATE DATABASE ${name}`);const url=new URL(process.env.DATABASE_URL!);url.pathname='/'+name;const db=new pg.Pool({connectionString:url.toString()});
process.env.TENCENT_MAP_KEY=''; // Isolated fixture; never modify .env or use the real provider Key.
const app=createApp(db);
const browser=await chromium.launch({channel:'msedge',headless:true});
// These legacy cases exercise Advanced operations. Quick default behavior has its own 10-place suite.
const newContext=browser.newContext.bind(browser);browser.newContext=async(options:any)=>{const context=await newContext(options);await context.addInitScript(()=>{new MutationObserver(()=>{const details=document.querySelector<HTMLDetailsElement>('details.advanced-coordinates');if(details&&!details.open)details.querySelector<HTMLElement>('summary')?.click();}).observe(document,{childList:true,subtree:true});});return context;};let vite:Awaited<ReturnType<typeof createServer>>|undefined;
const checks:string[]=[],pageErrors:string[]=[];await mkdir('reports/phase2/screenshots',{recursive:true});
try{
 for(const f of (await readdir('database/migrations')).filter(n=>n.endsWith('.sql')).sort())await db.query(await readFile(`database/migrations/${f}`,'utf8'));
 const category=(await db.query("INSERT INTO taxonomy_terms(dimension,code,name) VALUES('一级分类','TEST','测试分类') RETURNING id")).rows[0].id;
 for(let i=1;i<=3;i++)await db.query("INSERT INTO places(code,name,place_type,category_id,region,current_status,public_level) VALUES($1,$2,'主地点',$3,'测试区域','正常',$4)",[`WY-000${i}`,i===1?'测试父地点':i===2?'测试子地点':'未确认地点',category,i===2?'P2':'P1']);
 await db.query("UPDATE places SET corridor_order=substring(code from 4)::int*100");
 await db.query("UPDATE places SET parent_place_id=(SELECT id FROM places WHERE code='WY-0001') WHERE code='WY-0002'");
 const child=await addCandidate(db,'WY-0002',{latitude:27.761,longitude:117.991,coordinate_system:'GCJ-02',accuracy_meters:null,source_type:'manual_input',source_time:'2026-09-05T08:00:00Z'});await confirmCandidate(db,'WY-0002',child.id,null);
 await app.listen({host:'127.0.0.1',port:3102});
 vite=await createServer({configFile:false,root:'admin',plugins:[vue()],server:{port:5174,host:'127.0.0.1',https:undefined,proxy:{'/api':'http://127.0.0.1:3102'}}});await vite.listen();
 const context=await browser.newContext({...devices['iPhone 13'],permissions:['geolocation'],geolocation:{latitude:27.76,longitude:117.99,accuracy:6}});context.setDefaultTimeout(10000);const page=await context.newPage();page.on('pageerror',e=>pageErrors.push(e.message));
 // SDK contract stub: no fake provider keys and no outside tile requests. Explicitly marked in evidence.
 await page.addInitScript({path:'tests/tencent-sdk-stub.js'});
 await page.addInitScript("sessionStorage.setItem('adminToken','obsolete-test-value')");
 let credentialHeaders=0;page.on('request',r=>{if(r.url().includes('/api/admin')&&r.headers().authorization)credentialHeaders++;});
 await page.goto('http://127.0.0.1:5174/places/WY-0001');
 await page.getByRole('heading',{name:'测试父地点',exact:true}).waitFor();
 await page.getByLabel('位置确定度',{exact:true}).selectOption('certain');
 await page.getByRole('button',{name:'采集当前位置',exact:true}).tap();await page.getByText('手机位置已保存为候选，请核对实际落点后确认。').waitFor();
 const phone=(await db.query("SELECT * FROM coordinate_candidates WHERE source_type='phone_gps'")).rows[0];assert.equal(phone.raw_latitude,27.76);assert.equal(Number(phone.accuracy_meters),6);assert.equal(phone.raw_coordinate_system,'WGS84');assert.equal(phone.status,'pending');assert(phone.source_time);checks.push('浏览器定位 API 注入位置后保留原值/精度/时间，仅存候选');
 assert.equal(phone.position_certainty,'certain');
 await page.getByRole('button',{name:'核对并确认候选',exact:true}).tap();await page.getByRole('checkbox',{name:'我已人工核对地点、坐标系和落点'}).tap();await page.getByRole('button',{name:'确认写入正式历史'}).tap();await page.getByText('候选已确认；原有效坐标如存在，已保留为历史记录。').waitFor();checks.push('详情确认候选形成 active');

 await page.getByRole('button',{name:'手工输入',exact:true}).tap();
 const manualCount=Number((await db.query('SELECT count(*) n FROM coordinate_candidates')).rows[0].n);
 for(const [lat,lng,system] of [['27','117',''],['91','117','GCJ-02'],['27','181','GCJ-02']]){
  await page.getByLabel('纬度',{exact:true}).fill(lat);await page.getByLabel('经度',{exact:true}).fill(lng);if(system)await page.getByLabel('坐标系',{exact:true}).selectOption(system);
  await page.getByRole('button',{name:'保存手工候选'}).tap();assert.equal(await page.locator('.coordinate-form').evaluate((f:HTMLFormElement)=>f.checkValidity()),false);
 }
 assert.equal(Number((await db.query('SELECT count(*) n FROM coordinate_candidates')).rows[0].n),manualCount);checks.push('移动端非法经纬度和空坐标系被阻止，不产生候选');
 await page.getByLabel('纬度',{exact:true}).fill('27.78');await page.getByLabel('经度',{exact:true}).fill('117.98');await page.getByLabel('坐标系',{exact:true}).selectOption('GCJ-02');await page.getByRole('button',{name:'保存手工候选'}).tap();await page.getByText('已保存手工输入候选，尚未成为正式坐标。').waitFor();
 await page.getByRole('button',{name:'核对并替换正式坐标',exact:true}).tap();await page.getByRole('checkbox',{name:'我已人工核对地点、坐标系和落点'}).tap();await page.getByRole('button',{name:'确认写入正式历史'}).tap();await page.getByText('候选已确认；原有效坐标如存在，已保留为历史记录。').waitFor();
 assert.equal((await db.query("SELECT count(*)::int n FROM place_coordinates WHERE status='superseded'")).rows[0].n,1);checks.push('手工输入、替换、旧坐标保留');
 await page.getByRole('button',{name:'地图点选',exact:true}).tap();await page.getByLabel('位置确定度',{exact:true}).selectOption('certain');await page.locator('.map-canvas').tap({position:{x:80,y:160}});await page.getByRole('button',{name:'取消选点'}).tap();await expect(page.getByRole('button',{name:'保存地图候选'})).toBeDisabled();
 assert.equal((await db.query("SELECT count(*)::int n FROM coordinate_candidates WHERE source_type='map_click'")).rows[0].n,0);
 await page.locator('.map-canvas').tap({position:{x:80,y:160}});await page.locator('.map-canvas').tap({position:{x:180,y:160}});
 checks.push('移动端触摸点选、取消零写入、重选后仅保存最后选点');await page.getByRole('button',{name:'保存地图候选'}).tap();await page.getByText('已保存地图点选候选，尚未成为正式坐标。').waitFor();
 const map=(await db.query("SELECT * FROM coordinate_candidates WHERE source_type='map_click'")).rows[0];assert.equal(map.status,'pending');assert.equal(map.raw_latitude,27.79);assert.equal(map.raw_coordinate_system,'GCJ-02');assert.equal((await db.query("SELECT count(*)::int n FROM place_coordinates WHERE status='superseded'")).rows[0].n,1);await expect(page.getByRole('button',{name:'保存地图候选'})).toBeDisabled();checks.push('map_click 只存候选，不覆盖正式坐标；保存后清空选择');
 await page.getByRole('button',{name:'拒绝候选',exact:true}).tap();await page.getByLabel('拒绝原因').fill('测试点位不符');await page.getByRole('button',{name:'确认拒绝'}).tap();await page.getByText('候选已拒绝，原始记录仍保留。').waitFor();checks.push('拒绝候选并保留原因');
 assert.equal(await page.getByRole('region',{name:'历史坐标',exact:true}).locator('button,input,select').count(),0);
 await expect(page.getByRole('region',{name:'当前正式坐标',exact:true})).toBeAttached();await expect(page.getByRole('region',{name:'候选坐标',exact:true})).toBeAttached();
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 const sizes=await page.locator('.coordinate-manager button').evaluateAll(els=>els.map(el=>({text:el.textContent,height:el.getBoundingClientRect().height})));assert(sizes.every(el=>el.height>=44),JSON.stringify(sizes));
 checks.push('390×664 CSS 视口、移动 UA 与触摸模式：全流程 tap；三个坐标区分区，历史只读，按钮至少44px，无横向溢出');
 await page.getByRole('region',{name:'采集新候选',exact:true}).screenshot({path:'reports/phase2/screenshots/mobile-capture-touch.png'});
 await page.getByRole('region',{name:'历史坐标',exact:true}).screenshot({path:'reports/phase2/screenshots/mobile-history-readonly.png'});
 await page.screenshot({path:'reports/phase2/screenshots/coordinate-management-test.png',fullPage:true});
 await page.getByRole('link',{name:'内部地图',exact:true}).tap();await page.getByText('符合筛选条件的正式地点：2 个。').waitFor();
 await page.getByRole('button',{name:'WY-0001 测试父地点',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'WY-0002 测试子地点',exact:true}).count(),0);
 await page.evaluate(()=>{const maps=(window as any).__mapTest.maps;maps[maps.length-1].setZoom(15)});await page.getByRole('button',{name:'WY-0002 测试子地点',exact:true}).waitFor();
 await page.screenshot({path:'reports/phase2/screenshots/map-hierarchy-test.png',fullPage:true});checks.push('内部地图仅 active；缩小父点、放大子点（SDK 事件替身）');
 await page.getByLabel('公开等级',{exact:true}).selectOption('P2');await page.getByRole('button',{name:'查询地图'}).tap();await page.getByText('符合筛选条件的正式地点：1 个。').waitFor();
 await page.evaluate(()=>{const maps=(window as any).__mapTest.maps;maps[maps.length-1].setZoom(10)});await page.getByRole('button',{name:'WY-0002 测试子地点',exact:true}).waitFor();await page.evaluate(()=>(window as any).__mapTest.marker.handlers.click({geometry:{id:'WY-0002'}}));await page.getByRole('link',{name:'查看地点详情',exact:true}).tap();await page.getByRole('heading',{name:'测试子地点',exact:true}).waitFor();checks.push('筛选后无可见父点时保留子点，点击进入详情');

 const otherCategory=(await db.query("INSERT INTO taxonomy_terms(dimension,code,name) VALUES('一级分类','OTHER','其他分类') RETURNING id")).rows[0].id;
 await db.query("INSERT INTO places(code,name,place_type,category_id,region,current_status,public_level) VALUES('WY-0004','内部 P3','主地点',$1,'其他区域','临时关闭','P3')",[otherCategory]);
 const p3=await addCandidate(db,'WY-0004',{latitude:27.88,longitude:117.88,coordinate_system:'GCJ-02',accuracy_meters:null,source_type:'manual_input',source_time:'2026-09-07T08:00:00Z'});await confirmCandidate(db,'WY-0004',p3.id,null);
 await addCandidate(db,'WY-0004',{latitude:27.881,longitude:117.881,coordinate_system:'GCJ-02',accuracy_meters:null,source_type:'manual_input',source_time:'2026-09-07T08:01:00Z'});
 await page.getByRole('link',{name:'内部地图',exact:true}).tap();await page.getByText('符合筛选条件的正式地点：3 个。').waitFor();
 for(const [label,value,count] of [['分类','其他分类',1],['区域','其他区域',1],['地点状态','临时关闭',1],['公开等级','P3',1],['坐标状态','active_with_pending',1],['坐标状态','pending',0],['坐标状态','superseded',0],['坐标状态','revoked',0]] as const){
  await page.getByLabel(label,{exact:true}).selectOption(value);await page.getByRole('button',{name:'查询地图'}).tap();await page.getByText(`符合筛选条件的正式地点：${count} 个。`).waitFor();
  if(count===1){await page.getByRole('button',{name:'WY-0004 内部 P3',exact:true}).waitFor();assert.equal(await page.evaluate(()=>(window as any).__mapTest.geometries[0].position.getLat()),27.88);}
  await page.getByLabel(label,{exact:true}).selectOption(label==='坐标状态'?'active':'');await page.getByRole('button',{name:'查询地图'}).tap();await page.getByText('符合筛选条件的正式地点：3 个。').waitFor();
 }
 checks.push('移动端五类地图筛选逐项验证；P2/P3 后台精确点可见；无坐标/未确认/历史不显示');
 await page.screenshot({path:'reports/phase2/screenshots/mobile-map-filters.png',fullPage:true});
 await page.getByLabel('公开等级',{exact:true}).selectOption('P2');await page.getByRole('button',{name:'查询地图'}).tap();await page.getByText('符合筛选条件的正式地点：1 个。').waitFor();await page.evaluate(()=>(window as any).__mapTest.marker.handlers.click({geometry:{id:'WY-0002'}}));await page.getByRole('link',{name:'查看地点详情',exact:true}).tap();await page.getByRole('heading',{name:'测试子地点',exact:true}).waitFor();
 await page.setViewportSize({width:360,height:800});await page.screenshot({path:'reports/phase2/screenshots/mobile-coordinate-test.png',fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));checks.push('手机宽度详情可操作，无页面横向溢出');
 await page.getByRole('button',{name:'撤销当前坐标'}).tap();await page.getByLabel('撤销原因').fill('测试撤销');await page.getByRole('button',{name:'确认撤销',exact:true}).tap();await page.getByText('正式坐标已撤销，历史仍保留。').waitFor();checks.push('浏览器撤销当前正式坐标');
 const denied=await browser.newContext({...devices['iPhone 13']});await denied.addInitScript(()=>{Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition:(_:unknown,fail:Function)=>fail({code:1})}})});denied.setDefaultTimeout(10000);const deniedPage=await denied.newPage();await deniedPage.goto('http://127.0.0.1:5174/places/WY-0003');await deniedPage.getByRole('button',{name:'采集当前位置',exact:true}).tap();await deniedPage.getByText('定位权限被拒绝，请在浏览器设置中允许位置权限。').waitFor();await expect(deniedPage.getByRole('button',{name:'采集当前位置',exact:true})).toBeEnabled();checks.push('定位拒绝提示，不生成候选，按钮恢复可操作');
 await deniedPage.getByRole('link',{name:'内部地图',exact:true}).tap();await deniedPage.getByText('尚未配置腾讯地图 Key。',{exact:false}).waitFor();await deniedPage.screenshot({path:'reports/phase2/screenshots/map-key-required.png',fullPage:true});checks.push('未配置 Key 时明确提示，不冒充真实底图');

 for(const failure of [2,3,0]){
  const ctx=await browser.newContext({...devices['iPhone 13']});await ctx.addInitScript(`Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition:function(ok,fail){${failure?'fail({code:'+failure+'});':''}}}})`);
  ctx.setDefaultTimeout(10000);const p=await ctx.newPage();p.on('pageerror',e=>pageErrors.push(e.message));await p.goto('http://127.0.0.1:5174/places/WY-0003');
  if(failure===0)await p.clock.install();await p.getByRole('button',{name:'采集当前位置',exact:true}).tap();if(failure===0)await p.clock.fastForward(17000);
  await p.getByText(failure===2?'无法取得当前位置，请重试或改用手工输入。':'定位超时，请到信号较好的位置后重试。').waitFor();await expect(p.getByRole('button',{name:'采集当前位置',exact:true})).toBeEnabled();
  assert.equal((await db.query("SELECT count(*)::int n FROM coordinate_candidates c JOIN places p ON p.id=c.matched_place_id WHERE p.code='WY-0003'")).rows[0].n,0);
  await p.getByRole('alert').screenshot({path:`reports/phase2/screenshots/location-failure-${failure}.png`});await ctx.close();
 }
 checks.push('移动定位失败、浏览器超时、无回调16秒兜底均恢复操作且零写入');
 // Satellite and queue flow uses only the isolated fixture database above.
 await mkdir('reports/phase2/satellite/screenshots',{recursive:true});
 await page.getByRole('link',{name:'内部地图',exact:true}).tap();
 await page.getByRole('button',{name:'卫星影像',exact:true}).tap();
 assert.equal(await page.evaluate(()=>(window as any).__mapTest.maps.at(-1).baseMap.type),'satellite');
 await page.getByRole('button',{name:'标准地图',exact:true}).tap();
 assert.equal(await page.evaluate(()=>(window as any).__mapTest.maps.at(-1).baseMap.type),'vector');
 checks.push('内部地图标准/卫星双向切换，SDK底图调用正确');
 await page.getByRole('button',{name:'开始卫星判点',exact:true}).tap();await page.getByRole('heading',{name:'测试子地点',exact:true}).waitFor();
 await expect(page.getByRole('button',{name:'卫星影像',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.getByRole('button',{name:'保存地图候选'})).toBeDisabled();
 const beforePick=Number((await db.query('SELECT count(*) n FROM coordinate_candidates')).rows[0].n);
 await page.locator('.map-canvas').tap({position:{x:80,y:140}});await page.getByRole('button',{name:'保存地图候选'}).tap();
 await page.getByRole('alert').filter({hasText:'请选择位置确定度'}).waitFor();
 assert.equal(Number((await db.query('SELECT count(*) n FROM coordinate_candidates')).rows[0].n),beforePick);
 await page.getByLabel('位置确定度',{exact:true}).selectOption('certain');
 await page.getByRole('button',{name:'取消选点'}).tap();await expect(page.getByRole('button',{name:'保存地图候选'})).toBeDisabled();
 await page.locator('.map-canvas').tap({position:{x:80,y:140}});await page.locator('.map-canvas').tap({position:{x:180,y:140}});
 await page.getByRole('button',{name:'标准地图',exact:true}).tap(); // Must not relabel an already-picked satellite point.
 await page.getByRole('button',{name:'保存地图候选'}).tap();await page.getByText('已保存地图点选候选，尚未成为正式坐标。').waitFor();
 const satellite=(await db.query("SELECT * FROM coordinate_candidates WHERE source_reference='腾讯卫星影像人工判读' AND status='pending'")).rows[0];
 assert.equal(satellite.status,'pending');assert.equal(satellite.raw_latitude,27.79);assert.equal(satellite.raw_coordinate_system,'GCJ-02');assert.equal(satellite.source_type,'map_click');assert.equal(satellite.position_certainty,'certain');assert.equal(satellite.confidence_level,'C');assert.equal(satellite.accuracy_meters,null);
 checks.push('卫星点选取消/重选、必选确定度、GCJ-02候选来源按点击时固定，切换底图不误标');
 await page.getByRole('button',{name:'核对并确认候选',exact:true}).tap();
 await page.getByRole('checkbox',{name:'我已人工核对地点、坐标系和落点'}).tap();await page.getByRole('button',{name:'确认写入正式历史'}).tap();
 await page.getByRole('button',{name:'下一个无正式坐标地点',exact:true}).waitFor();
 const confirmed=(await db.query('SELECT * FROM place_coordinates WHERE candidate_id=$1',[satellite.id])).rows[0];assert.equal(confirmed.position_certainty,'certain');assert.equal(confirmed.status,'active');
 assert.equal((await db.query('SELECT count(*)::int n FROM verifications')).rows[0].n,0);
 await page.locator('.verification-summary').filter({hasText:'未有实地核验记录'}).waitFor();
 await page.getByRole('button',{name:'卫星影像',exact:true}).tap();
 await page.screenshot({path:'reports/phase2/satellite/screenshots/mobile-satellite-confirmed.png',fullPage:true});
 await page.evaluate(()=>{const w=window as any;const map=w.__mapTest.maps.at(-1);map.setCenter(new w.TMap.LatLng(27.80,118.01));map.setZoom(17);});
 await page.getByRole('button',{name:'下一个无正式坐标地点',exact:true}).tap();await page.getByRole('heading',{name:'未确认地点',exact:true}).waitFor();
 await expect(page.getByRole('button',{name:'保存地图候选'})).toBeDisabled();await expect(page.getByLabel('位置确定度',{exact:true})).toHaveValue('');
 assert.equal(await page.evaluate(()=>(window as any).__mapTest.maps.at(-1).getZoom()),17);
 assert.equal(await page.evaluate(()=>(window as any).__mapTest.maps.at(-1).getCenter().getLat()),27.80);
 assert.equal(await page.evaluate(()=>(window as any).__mapTest.maps.at(-1).baseMap.type),'satellite');
 checks.push('确认后下一地点免返列表，保留地图视野，清空上一地点选点/确定度，核验零新增');
 await page.getByRole('button',{name:'标准地图',exact:true}).tap();await page.locator('.map-canvas').tap({position:{x:80,y:140}});
 await page.getByLabel('位置确定度',{exact:true}).selectOption('approximate');await page.getByRole('button',{name:'保存地图候选'}).tap();
 await page.getByText('已保存地图点选候选，尚未成为正式坐标。').waitFor();
 const standard=(await db.query("SELECT * FROM coordinate_candidates c JOIN places p ON p.id=c.matched_place_id WHERE p.code='WY-0003'")).rows[0];assert.equal(standard.source_reference,'腾讯标准地图人工判点');assert.equal(standard.position_certainty,'approximate');
 await page.getByRole('button',{name:'核对并确认候选',exact:true}).tap();await page.getByRole('checkbox',{name:'我已人工核对地点、坐标系和落点'}).tap();await page.getByRole('button',{name:'确认写入正式历史'}).tap();
 await page.getByText('全部地点均已有正式坐标。',{exact:true}).waitFor();await expect(page.getByRole('button',{name:'下一个无正式坐标地点'})).toBeDisabled();
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:'reports/phase2/satellite/screenshots/mobile-queue-complete.png',fullPage:true});
 checks.push('标准图来源独立、连续处理结束提示正确，360px无横向溢出');
 assert.equal(await page.getByRole('textbox',{name:'管理员令牌'}).count(),0);assert.equal(await page.getByRole('button',{name:'退出管理'}).count(),0);assert.equal(await page.evaluate(()=>sessionStorage.getItem('adminToken')),null);assert.equal(credentialHeaders,0);checks.push('移动端直接进入详情及地图，无令牌输入/退出控件，无认证请求头，旧令牌已清理');
 // Desktop ordering interaction is tested only in this isolated database.
 await mkdir('reports/phase2/corridor/screenshots',{recursive:true});
 const desktop=await browser.newContext({viewport:{width:1440,height:1000}});await desktop.addInitScript({path:'tests/tencent-sdk-stub.js'});const desk=await desktop.newPage();desk.on('pageerror',e=>pageErrors.push(e.message));
 await desk.goto('http://127.0.0.1:5174/places');
 await expect(desk.locator('thead th').first()).toHaveText('路线顺序');
 await expect(desk.locator('tbody tr').first()).toContainText('WY-0001');
 await desk.getByRole('button',{name:'调整WY-0002路线顺序',exact:true}).click();await desk.getByLabel('新顺序号',{exact:true}).fill('50');await desk.getByRole('button',{name:'取消调整'}).click();
 assert.equal((await db.query("SELECT corridor_order FROM places WHERE code='WY-0002'")).rows[0].corridor_order,200);
 const oldPlaces=(await db.query('SELECT * FROM places ORDER BY code')).rows;
 await desk.getByRole('button',{name:'调整WY-0002路线顺序',exact:true}).click();await desk.getByRole('button',{name:'上移',exact:true}).click();await expect(desk.locator('tbody tr').first()).toContainText('WY-0002');
 await desk.getByRole('button',{name:'调整WY-0002路线顺序',exact:true}).click();await desk.getByRole('button',{name:'下移',exact:true}).click();await expect(desk.locator('tbody tr').first()).toContainText('WY-0001');
 assert.deepEqual((await db.query('SELECT * FROM places ORDER BY code')).rows,oldPlaces);
 checks.push('电脑列表默认路线排序；取消零写入，上移/下移只交换顺序且可还原');
 await desk.getByRole('button',{name:'调整WY-0002路线顺序',exact:true}).click();await desk.getByLabel('新顺序号',{exact:true}).fill('105');await desk.getByRole('button',{name:'保存路线顺序',exact:true}).click();await expect(desk.locator('tbody tr').filter({hasText:'WY-0002'})).toContainText('0105');
 await desk.screenshot({path:'reports/phase2/corridor/screenshots/desktop-order-controls-isolated.png',fullPage:true});checks.push('电脑手工插入顺序号与四位补零显示通过');
 await db.query("UPDATE places SET map_display_role='group' WHERE code='WY-0001'");await db.query("UPDATE places SET map_display_role='hidden' WHERE code='WY-0003'");
 await desk.goto('http://127.0.0.1:5174/map');await desk.getByText('符合筛选条件的正式地点：3 个。').waitFor();await desk.getByRole('button',{name:'[集合] WY-0001 测试父地点',exact:true}).waitFor();
 assert.equal(await desk.evaluate(()=>(window as any).__mapTest.geometries[0].styleId),'group');
 await desk.screenshot({path:'reports/phase2/corridor/screenshots/desktop-group-map-isolated.png',fullPage:true});checks.push('电脑地图group集合样式、hidden排除，缩小时父级集合优先');
 await desktop.close();
 assert.deepEqual(pageErrors,[]);await writeFile('reports/phase2/browser-checks.json',JSON.stringify({passed:true,checks,pageErrors,mapProviderVerification:'SDK contract stub; no real Tencent key provided',phoneVerification:'iPhone 13 device emulation, isMobile=true, hasTouch=true, touch tap flow at 390px plus 360px viewport; not physical iOS Safari or real GPS' ,checkedAt:new Date().toISOString()},null,2));console.log(JSON.stringify({passed:true,checks},null,2));
}finally{await browser.close();await vite?.close();await app.close();await db.end();await admin.query(`DROP DATABASE ${name} WITH (FORCE)`);await admin.end();}
