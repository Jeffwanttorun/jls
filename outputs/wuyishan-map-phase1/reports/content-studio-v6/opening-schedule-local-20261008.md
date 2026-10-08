# V6 本地开放情况完善验收记录

## 操作入口

访问 https://127.0.0.1:5173/studio/places ，编辑或新建地点，在「基本信息」之后的「开放情况」填写。路线和地图的新建入口继续共用同一个地点编辑器。

运营状态保留正常运营、暂停开放、在建 / 尚未开放、待核实，以及原数据中的特殊状态。独立开放安排支持每天、仅周末、指定星期、预约、不定期、时间待核实；指定星期可勾选周一至周日。中英文时段、补充说明、来源均可选填，最后核实日期手动填写。

选择明确安排后，勾选「已核实此开放安排」才在访客预览显示确认安排。未核实仍显示时间待核实；改变安排类型或开放星期会取消核实标记。保存不要求英文、时段、照片、来源或日期全部填写。暂停、在建等状态同时明确提醒当前不开放，历史安排不代表能够入馆。

## 数据与集成

复用 StudioPlace.publicStatus，新增可选 openingSchedule，包含 kind、weekdays、hours、notes、source、lastVerifiedAt、confirmed。KnowledgePlace 同样读取此字段；共享校验和中英文格式化函数，Vue/Astro 分别使用薄展示组件。

沿用原创建、保存、Revision、预览、ZIP 导入导出及完整数据库备份流程。服务器在原保存事务前检查字段，非法值返回 400，不产生部分更新。没有数据库 migration，也没有批量改写旧地点。旧「正常 / 开放」只表示运营状态，不自动设置每天开放；缺少准确时段时不计算或宣称「现在营业」。核实日期不使用保存日期替代。

地点详情、路线主地点及服务卡片、主题卡片使用同一套中英文显示。维护台地点和路线预览新增语言切换，主题页面提供地点卡片预览。公开页面代码在本地构建检查，未部署。

## 验证结果

- 单元测试 44 / 44 通过：旧数据兼容、六种安排、星期和日期校验、选填时段、语言字段、暂停和在建提醒、未核实内容保守显示。
- TypeScript、Vue 类型检查和维护台构建通过。
- 网站完整构建通过：Astro 80 文件检查，0 errors / warnings / hints；131 HTML 文件验证通过。公开地图安全检查仍为 41 个点、6 段道路、952 个原始几何点。
- 独立临时测试数据库：周末创建、预约与暂停编辑、非法星期拒绝且草稿不变、Revision 恢复、ZIP 导出导入字段及关系摘要一致。完整 SQL 备份恢复 25 张表数量与内容摘要一致；临时数据库已由测试 finally 清理。
- Chromium / WebKit × 375 / 390px：新建、保存重开、周末、预约、暂停、周一/三/五多选、手工核实日期、中文和英文地点/路线/主题草稿预览通过，无横向溢出或页面异常。
- 实际 Astro 页面组件中英 × 地点 / 路线 / 主题 × 5 个场景共 30 组通过：周末、预约、暂停并指定星期、旧正常数据、未核实每天安排。无「现在营业」断言误报。
- 上一轮新建地点完整端到端流程回归通过，包括两个主题、图片、Route / Stage / Group、角色顺序、未保存路线保护、归档恢复、ZIP 与数据库恢复。
- 本地与局域网 HTTPS 服务正常、证书验证通过；三个发布接口保持 403。
- 真机 iPhone、Safari 软键盘和相机没有进行实机验收；本次手机验证为上述 Chromium / WebKit 窄屏自动化。

## 原有数据保护

修改前保留 Git 全量 bundle、工作状态和原有未跟踪报告；完整本地 ZIP 备份已通过隔离恢复验证，路径 work/local-hardening/backups/2026-10-08T02-40-18-626Z-full.zip。

前后逐项摘要一致：真实草稿仍为版本 13，公开快照、所有原有业务表、版本历史、41 个公开地点、6 段道路、952 个几何点、27 个媒体记录与文件字节均未改变。本轮测试使用隔离数据库和媒体目录，不在真实草稿插入测试记录。原有未跟踪 production-backend-audit-20261001.md 保留。

只在现有 codex/v6-local-hardening 分支工作，起点 db544e2815cf3d4a02981ed286d24cf4cf852de2（保留 badc9f5 后已有修改）；没有推送 GitHub、生产部署或连接生产数据库。

## 修改文件

路径均相对现有仓库。

- outputs/wuyishan-map-phase1/shared/place-opening.ts
- outputs/wuyishan-map-phase1/shared/content-studio.ts
- outputs/wuyishan-map-phase1/shared/studio-place-creation.ts
- outputs/wuyishan-map-phase1/backend/src/studio-transfer.ts
- outputs/wuyishan-map-phase1/admin/src/StudioOpeningFields.vue
- outputs/wuyishan-map-phase1/admin/src/StudioOpeningDisplay.vue
- outputs/wuyishan-map-phase1/admin/src/StudioPlaceEditor.vue
- outputs/wuyishan-map-phase1/admin/src/StudioPlaces.vue
- outputs/wuyishan-map-phase1/admin/src/StudioRouteEditor.vue
- outputs/wuyishan-map-phase1/admin/src/StudioThemes.vue
- outputs/wuyishan-map-phase1/admin/src/style.css
- outputs/localdad-wuyishan-bilingual/src/components/PlaceOpening.astro
- outputs/localdad-wuyishan-bilingual/src/components/KnowledgePlacePage.astro
- outputs/localdad-wuyishan-bilingual/src/components/KnowledgeRoutePage.astro
- outputs/localdad-wuyishan-bilingual/src/components/KnowledgeThemePage.astro
- outputs/localdad-wuyishan-bilingual/src/data/knowledge-places.ts
- outputs/localdad-wuyishan-bilingual/src/types/knowledge-map.ts
- outputs/wuyishan-map-phase1/tests/place-opening.test.ts
- outputs/wuyishan-map-phase1/tests/opening-e2e.ts
- outputs/wuyishan-map-phase1/tests/opening-site-fixture.astro（只由测试临时复制并清理，不是正式页面）
- 本验收记录。
