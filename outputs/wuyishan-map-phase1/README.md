> 2026-09-10 新增严格隔离的“第三阶段游客端低保真可点击原型 V0.1”。它只读当前第二阶段数据库，使用独立本地预览接口与内容配置，不新增迁移、不改变公共接口。运行 `./scripts/start-prototype.ps1`，电脑打开 `https://127.0.0.1:5174/`；同一可信局域网手机打开脚本显示的 5174 地址。详见[原型验收报告](第三阶段游客端低保真原型_验收报告.md)。这不是正式第三阶段批准。

> 2026-09-10 封版审查：**A：第二阶段可以正式封版**（仅本地/家庭可信局域网）。以 [第二阶段最终独立审查报告](第二阶段_最终独立审查报告.md) 为当前结论。最新完整备份为 [phase2-final-full.sql](database/seed/phase2-final-full.sql)，真实库 61 个地点，WY-0011 保持在回收站；没有测试修改真实数据。以下旧版本记录保留追溯。

> 2026-09-09 最新更新：已增加删除定位（仅撤销并保留历史）、编辑名称及历史名称检索，应用 008/009 迁移。最新结果和已知限制以[后台自助维护验收报告](reports/phase2/后台自助维护_验收报告_20260909.md)为准；下文较早报告保留为阶段记录。

<!-- quick satellite update -->
> 连续卫星判点已简化：打开无坐标地点即默认卫星图，点击自动保存候选，“确认此位置”后自动下一地点；高级操作折叠。详见[本次体验优化报告](reports/phase2/连续卫星判点极简化_验收报告_20260909.md)。数据库、历史与公开安全规则未修改。

<!-- corridor-v1 update -->
> 2026-09-09 更新：本次一号风景道整理已落库，61 条档案（60 当前地点、1 重复档案）、58 已排、2 待排。新增006/007迁移；列表和连续判点按路线顺序。最新结果以[本次落库报告](reports/phase2/一号风景道数据整理_落库报告_20260909.md)为准；下文旧数量为此前阶段记录。集合显示角色仅预览，尚未赋值。

# 武夷山奶爸地图：第二阶段

本阶段实现地点坐标采集、人工确认、历史保留与内部地图管理。2026-09-08 更新以“卫星影像人工判点”为主要坐标建设方式，现场 GPS 作为补充。完成后等待人工验收，不进入游客产品开发。目录沿用 `wuyishan-map-phase1`，版本为 0.2.1。

**当前采用“内部局域网无认证模式”，仅用于本地/家庭局域网内部管理和现场测试，不适用于公网部署。未来公网部署前必须恢复身份认证和访问控制。**

2026-09-08 已移除内部页面和接口的管理员令牌验证，变更证据见 [无认证模式验收记录](reports/phase2/内部局域网无认证模式_变更验收_20260908.md)。

移动端补充验收与截图见 [测试与截图索引](reports/phase2/测试与截图索引.md)。第二阶段完整交付及测试证据见 [第二阶段报告](reports/phase2/第二阶段报告.md)，数据库变更见 [坐标模型说明](database/PHASE2.md)。第一阶段报告和原始 Excel 保留。

## 卫星影像连续判点

在内部地图的待处理队列选择熟悉地点；无坐标详情默认进入卫星判点。点击地图后自动保存候选，点击“确认此位置”完成确认并自动进入下一个地点。标准地图可切换、确定度可展开调整；已有正式坐标通过常用操作区“重新定位”，明确确认替换后保留旧记录。坐标确认不会生成实地核验记录，位置确定度与原 A—D 来源依据等级独立。

详见 [卫星判点验收报告、测试与真实底图截图](reports/phase2/卫星影像人工判点_验收报告_20260908.md)。本机已备份并执行005迁移、重启；最终人工验收改在电脑端完成真实地点判点、候选、确认、替换及历史检查；用户已确认 iPhone HTTPS、真实定位和地图访问通过，无需手机卫星闭环。详见 [最终人工验收口径](reports/phase2/最终人工验收口径_20260909.md)。

## 本机启动

在本项目目录执行：

```powershell
./scripts/start-local.ps1
```

当前电脑直接打开 `https://127.0.0.1:5173/places`，内部地图为 `https://127.0.0.1:5173/map`。同一局域网手机使用 `https://192.168.2.178:5173/map`，无需输入令牌；地址随电脑局域网 IP 变化。

本机独立 PostgreSQL 17.6 / PostGIS 3.6.2 位于工作区 `work/runtime/pgsql`，数据位于 `work/pgdata`，端口 55432，未注册系统服务。46 个地点已在库中，不需重复导入。停止：`./scripts/stop-local.ps1`，保留数据库文件。

源码压缩包不含 `.env`、依赖目录或 PostgreSQL 运行时。数据库密码和证书私钥不得写入公开资料。

## 腾讯地图配置

当前机器已配置真实腾讯地图 Key，电脑真实底图已验证显示。以下配置说明供新机器使用，不应覆盖现有 Key。

在腾讯位置服务控制台创建适用的 JavaScript API GL Key，按实际使用地址配置域名限制，在本机 `.env` 添加：

```dotenv
TENCENT_MAP_KEY=你自己的Key
```

重启 API；已打开页面点击“重试地图”。管理端从内部 `/api/admin/map-config` 取得浏览器地图 Key。浏览器 Key 本身会对可访问后台的局域网设备可见，应使用供应商支持的域名限制。本项目未设置代理底图或借用演示 Key。SDK 文档：[腾讯地图 JavaScript API GL](https://lbs.qq.com/webApi/javascriptGL/glGuide/glBasic)。

## 手机浏览器定位

手机与电脑需能通过受控局域网连接。准备手机浏览器信任、且覆盖实际域名或局域网 IP 的 HTTPS 证书与私钥，在 `.env` 配置：

```dotenv
ADMIN_HOST=0.0.0.0
DEV_HTTPS_CERT=C:/certs/internal-map-cert.pem
DEV_HTTPS_KEY=C:/certs/internal-map-key.pem
```

重启管理端，在手机打开证书覆盖的 `https://实际主机:5173/places`，直接进入后台，采集时按提示允许定位。只让可信局域网设备访问该端口；API 可继续绑定 127.0.0.1，经 Vite 代理访问。电脑的 localhost 定位例外不等于手机通过 HTTP 局域网地址也能定位。证书私钥须放在项目以外，不能打包。

点击“采集当前位置”保留浏览器 WGS84 经纬度、精度、时间，只建立 pending 候选。详情核对地点、坐标系与落点后，勾选人工核对并确认。已存在正式坐标时，这次确认将其保留为 superseded 历史。位置权限拒绝或超时会提示，不产生候选。

依据：[W3C Geolocation](https://www.w3.org/TR/geolocation/)、[MDN Geolocation](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation)。实体 iPhone Safari 的可信 HTTPS 与真实定位已由用户现场确认通过，精度约8米，验证过程未上传或保存。无认证改动后的手机直接访问，以及真实地点采集完整流程分别验收，不由该结果推定通过。

## 新机器初始化或第一阶段升级

需要 Node.js 22+、pnpm、PostgreSQL 17+ 与 PostGIS。依赖固定在锁文件中。

```powershell
pnpm install --frozen-lockfile
node scripts/init-env.mjs
# 使用随项目配置的 Docker，或自行准备独立 PostgreSQL/PostGIS
# Docker 路径未在本机验证，本机使用 Windows 独立运行时
docker compose up -d db
pnpm db:migrate
```

`init-env.mjs` 不覆盖已有 `.env`；使用现有 PostgreSQL 时先修改 DATABASE_URL 并跳过 Docker。迁移账号需要创建 PostGIS 扩展的权限。已运行第一阶段的数据库，先备份再直接 `pnpm db:migrate`，按现有版本补齐 003—010 迁移；每个文件独立提交，已执行文件校验摘要后跳过。旧记录不回填推断位置确定度。请勿重建已有库或再次执行全量快照。

全新数据库可选择“执行迁移后导入 Excel”：

```powershell
pnpm import:preview --out reports/new-preview.json
# 核对预览后
pnpm import:apply --preview reports/new-preview.json --out reports/new-result.json
pnpm db:check --out reports/new-checks.json
```

或将封版快照 `database/seed/phase2-final-full.sql` 恢复到一个空数据库：

```powershell
psql -h 127.0.0.1 -p 5432 -U wymap -d new_empty_database -v ON_ERROR_STOP=1 -f database/seed/phase2-final-full.sql
```

两种初始化方式二选一。封版备份含当前 61 个地点、原始导入审计、全部历史及 001—010 迁移版本，保留 WY-0011 的真实删除状态。不得在已有数据的库上叠加执行。第一阶段原快照 `phase1-full.sql` 保留；若从它恢复，随后需执行 `pnpm db:migrate`。

手动运行服务需两个终端：`pnpm dev:api` 和 `pnpm dev:admin`。不要重复启动已占用相同端口的服务。

## 自动化检查

```powershell
pnpm build
pnpm test
pnpm test:integration
pnpm test:browser
pnpm db:check --out reports/phase2/database-checks.json
# pg_dump / psql 已在 PATH，或将 PG_BIN 指向其目录
pnpm db:backup
```

数据库集成和浏览器测试需 CREATEDB 权限，均创建随机独立测试库并在结束后清理；不会往实际地点写入模拟坐标。浏览器测试使用本机 Edge、端口 3102/5174、模拟 geolocation 与标明的腾讯 SDK 事件替身，不代表真实手机或供应商底图已通过验证。备份先写临时文件，用同一个只读数据库快照核对空库恢复结果，验证成功后才替换目标文件。默认备份命令会生成/更新 `database/seed/phase2-full.sql` 与恢复检查报告，可用 `--out` 和 `--report` 指定新路径。

未开发游客地图、小程序、用户账户、评论、收藏、支付、正式路线导航、DJI 自动坐标匹配。下一步为第二阶段人工验收。
> 2026-09-09 最新更新：网页后台已增加地点软删除和回收站恢复。删除不改写坐标历史、名称历史、排序、路线或其他关联；当时快照回收站为空（历史记录；现以本报告开头的封版状态为准）。详见[地点删除与回收站验收报告](reports/phase2/地点删除与回收站_验收报告_20260909.md)。
> 2026-09-09 补充：删除父地点时可在同一事务内解除子地点父级或转移到合法新父地点；恢复父地点不会自动抢回子地点。详见[父地点删除子地点处理验收报告](reports/phase2/父地点删除子地点处理_验收报告_20260909.md)。
