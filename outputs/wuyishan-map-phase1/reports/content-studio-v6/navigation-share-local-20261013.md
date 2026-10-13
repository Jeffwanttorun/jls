# V6 多平台导航与分享：本地开发交付

日期：2026-10-13。此报告记录 Codex 自测结果，最终验收交由 Work 独立检查；不代表真机验收通过。

## 基线与数据保护

- 基于现有 checkout，分支 `codex/v6-local-hardening`，开始 HEAD `0b72266d23a012771a296fefff61ffc57ce9a90a`。
- 原有未跟踪的 `production-backend-audit-20261001.md` 保留，不纳入本次提交。没有重置用户代码，没有新建正式数据库。
- 修改前代码 bundle：`work/navigation-safety/before.bundle`；数据库、媒体完整可恢复备份：`work/local-hardening/backups/2026-10-13T03-25-10-348Z-full.zip`，已经隔离恢复核验。
- 前后核对全部业务表摘要、公开快照、真实草稿及历史、全部媒体文件 SHA-256，结果一致：真实草稿 revision **13**、公开地点 **41**、道路 **6**、路线几何点 **952**、媒体资产记录 **27**、媒体文件 **31**。
- 写入、历史恢复、ZIP 恢复、数据库恢复全部使用临时隔离数据库及媒体副本，结束后清理自己创建的测试数据库。没有向真实草稿写入导航或分享配置。
- 没有推送 GitHub、没有生产部署、没有连接生产数据库；本地发布接口仍返回 403。

## 实现

共用 `shared/place-actions.ts` 处理坐标转换、目的地选择、平台链接、公开地点永久路径和可分享地图状态；游客端共用 `VisitorActions.astro` 与 `visitor-actions.ts`，维护台复用原地点编辑器。

**导航**支持高德、百度、腾讯、苹果。用户选择平台，可记住上次选择，始终可切换。手机根据设备生成相应 App 链接，同时提供网页地图和复制地点名称、坐标、说明。没有宣称可以识别已安装 App。腾讯 App URI 需要有效开发者 key：本地游客预览复用已有地图配置；独立站点构建可使用 `PUBLIC_TENCENT_URI_KEY`，缺少 key 时保留腾讯网页导航，不生成伪造 App 链接。

地点详情与地图弹出卡有“导航 | 分享”。分享支持浏览器系统分享（有能力时）、复制永久链接、本地生成二维码。路线中的地点卡分享对应地点；路线、主题、完整地图和当前地图状态也复用同一模块。地图状态只携带支持的分类和选中 WY ID，打开后恢复；不会携带用户定位数据。地点分享与当前地图状态分享分别有明确入口。

漫水桥玩水点的稳定详情路径：中文 `/zh/place/WY-0009`，英文 `/place/WY-0009`；没有分享到地图首页。未公开草稿不生成公开分享按钮/URL。本地预览分享链接使用当前本地主机，并明确告知它尚未发布到公网。

元数据复用真实地点名称、简介和封面，增加可选中英文分享标题/摘要；没有照片时使用新增的品牌默认图 `map-share-default.png`。保留中英文 canonical、hreflang 和 Open Graph。未知真实照片尺寸不再套用默认图尺寸。

**维护台入口**：现有地点编辑器展开“导航目的地与分享”，可维护独立导航坐标、坐标系、目的地中英文名称、入口/停车说明、车辆直达确认及可选中英文分享标题和摘要。支持现有腾讯地图点选、手动坐标及浏览器定位。修改独立目的地不改变地图标记坐标；修改目的地坐标会清除先前车辆直达确认，防止错误沿用。

未确认车辆可直达的地图中心不会默认提供驾车方案，提示先核实入口和步行路线；只有明确独立入口坐标且确认车辆可达时才提供驾车选项。设置缺省为无独立坐标、车辆直达待核实。

新字段是现有 schemaVersion 2 地点 JSON 的向后兼容可选字段，沿用原保存事务、revision 冲突保护、历史、草稿预览、导入验证和 ZIP/数据库备份，不另建地点结构，不需要数据库 migration。已有地点新增、开放安排及 QA 修复均保留。

## 坐标核查与官方链接依据

本地正式坐标记录有 46 条 GCJ-02（44 活跃、2 撤销）；维护台当前 42 个草稿地点和不可变公开快照 41 个地点使用 WGS84。维护台腾讯点选返回 GCJ-02，进入编辑数据时按原逻辑转 WGS84。现有游客公开地图使用 Leaflet/OSM 的 WGS84，维护台腾讯底图保持原样。没有替换底图或重写原地点坐标。

导航字段明确标注坐标系。统一服务只在平台链接边界转换：高德/腾讯 GCJ-02，百度 BD-09，苹果 Map URL WGS84；同坐标系不再转换。自动测试覆盖转换、往返误差、平台经纬度顺序及避免重复转换。此结果证明链接参数与转换逻辑，不等于实地校准所有地图 App。

官方依据：

- [高德网页 URI 导航](https://developer.amap.com/api/uri-api/guide/travel/route)、[iOS](https://developer.amap.com/api/amap-mobile/guide/ios/route)、[Android](https://developer.amap.com/api/amap-mobile/guide/android/route)。
- [百度网页 URI](https://lbsyun.baidu.com/docs/webapi?title=mapadjustment%2Furi%2Fweb)、[iOS](https://lbsyun.baidu.com/docs/webapi?title=mapadjustment%2Furi%2Fios)、[Android](https://lbsyun.baidu.com/docs/webapi?title=mapadjustment%2Furi%2Fandriod)。
- [腾讯 App 路线 URI](https://lbs.qq.com/webApi/uriV1/uriGuide/uriMobileRoute)、[网页路线 URI](https://lbs.qq.com/webApi/uriV1/uriGuide/uriWebRoute)。
- [Apple Unified Map URLs](https://developer.apple.com/documentation/mapkit/unified-map-urls)。新版网页 Directions URL 与 iOS 兼容 Map Link 分别使用对应参数。

苹果地图在中国区域的实际落点、旧系统兼容与路由效果仍需真机检查；未声称已解决所有区域 SDK 的坐标差异。

## 测试结果

| 检查 | 结果 |
| --- | --- |
| 单元及既有回归单测 | 54/54 通过 |
| TypeScript / Vue 检查及维护台构建 | 通过 |
| Astro 完整构建 | 通过，131 个 HTML 页面验证 |
| 既有地点新增、开放安排、QA 修复隔离浏览器回归 | 全部通过；包括路线分组、主题、媒体、草稿、预览、ZIP恢复 |
| 导航配置保存、创建、非法坐标回滚、历史恢复 | 通过；原地图坐标不变 |
| Chromium / WebKit 维护台 320/375/390px | 6 组通过 |
| Chromium / WebKit 游客端 1280/320/375/390px × 中英文 | 16 组通过 |
| 地点、路线、主题、完整地图、分类与选中状态分享 | 通过 |
| 二维码 | 实际像素解码通过，地址与目标详情/地图状态一致 |
| 系统分享与复制 | 浏览器能力替身、取消与回退检查通过；非真实手机分享面板验收 |
| ZIP 导入隔离数据库 | 地点新字段、主题、路线关系、媒体及草稿内容一致 |
| PostgreSQL 完整隔离恢复 | 25 张表摘要一致 |
| 持续运行的实际游客预览 | 修复构建后开发缓存过期问题后，12 组手机宽度中英文复测通过，标题/关闭按钮分离、无横向溢出、二维码和键盘 Escape 正常 |
| 本地实际数据库/媒体保护 | 前后逐项指纹一致 |

本次导航端到端结果：`work/navigation-tests/5c0be486-7680-4506-b4fb-919df23f6550`（24 项检查）。已有回归结果分别保存在 `work/new-place-tests/afc13b76-0c7a-4b08-8fd1-0890876d10ee`、`work/opening-tests/20ec3a9c-be27-4fd0-bda8-cddb240ec586`、`work/qa-fix-tests/05a97104-53b3-439c-8aaf-a304e1fd0053`。实际运行预览复测：`work/navigation-safety/live-screenshots/results.json`。

## Work 独立复测入口

1. 维护台：`https://127.0.0.1:5173/studio/places`。已有地点可只读查看“导航目的地与分享”；需要修改、取消、冲突或恢复验收时使用隔离测试环境，避免覆盖真实草稿。
2. 游客中文：`http://127.0.0.1:5175/zh/place/WY-0009`；英文：`http://127.0.0.1:5175/place/WY-0009`。导航选择四个平台，检查坐标、复制说明、网页回退及可见 App 链接。现有地点尚未录入入口时应提示车辆直达未确认。
3. 地图：`http://127.0.0.1:5175/zh/map`。分类筛选并点击地点，分别分享地点与当前地图状态，在新标签打开验证分类、选中地点和对应详情。
4. 从站内路线和兴趣主题页测试分享，再测试路线地点卡分享应直达 WY 详情。
5. 320/375/390px 展开弹窗，检查滚动、选择、复制、二维码、关闭按钮和键盘退出。桌面也检查系统分享不可用时仍能复制与显示二维码。
6. 自动化可复跑：维护台项目 `node --import tsx tests/navigation-e2e.ts`（需要本地 Node、数据库和 Playwright 环境；自动创建与清理自己的隔离数据库/媒体副本）。不要复制测试 fixture 到真实公开数据。

尚待真机：iPhone Safari / Android 的已安装和未安装四款地图、微信/抖音内置浏览器限制、系统分享面板、相机扫码、苹果地图中国区域落点。当前游客预览仅绑定 loopback，手机不能把 `127.0.0.1` 当成电脑；真机测试需另行配置可达的 HTTPS 预览，不代表本轮已完成该验收。QA-01 原生刷新/关闭确认也仍待人工验收。

本地维护台及游客预览保持运行。新增根目录 `启动游客本地预览.cmd` 可重启游客预览；先运行已有维护台启动器。完整构建会更新开发依赖缓存，若已有预览页面提示缓存过期，应重启已登记的游客开发服务并重新加载页面。

## 修改文件

- 公共模型与服务：`shared/place-actions.ts`、`shared/content-studio.ts`、`shared/editor-changes.ts`、`backend/src/studio-transfer.ts`。
- 维护台：`admin/src/StudioPlaceEditor.vue`、`admin/src/StudioPlaceActionsFields.vue`。
- 游客统一模块：`src/components/VisitorActions.astro`、`src/lib/visitor-actions.ts`、`src/styles/visitor-actions.css`。
- 页面与地图：`KnowledgePlacePage.astro`、`KnowledgeRoutePage.astro`、`KnowledgeThemePage.astro`、`MapExplorer.astro`、`PlaceLocationMap.astro`、`BaseLayout.astro`、中英文地图页。
- 数据与类型：`knowledge-places.ts`、`wuyishan-public-map.ts`、`knowledge-map.ts`、`map.ts`。
- 依赖及资源：Astro `package.json`、`pnpm-lock.yaml`、`astro.config.mjs`、`public/images/map-share-default.png`。
- 测试：`tests/place-actions.test.ts`、`tests/navigation-e2e.ts`、`tests/navigation-site-fixture.astro`、站点 `scripts/navigation-browser.mjs`。
- 本地启动：`scripts/start-visitor-preview.ps1`、根目录 `启动游客本地预览.cmd`；本报告。

本地提交号另附 `commit.txt`，截图与机器可读测试结果随交付目录提供。
