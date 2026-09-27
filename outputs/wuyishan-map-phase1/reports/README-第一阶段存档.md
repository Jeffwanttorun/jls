# 武夷山奶爸地图：第一阶段

本项目只完成数据库、首批 Excel 迁移、只读地点列表和详情。没有地图、小程序、游客账户、评论、收藏、订单、支付、会员或推荐功能。人工验收前不进入下一阶段。

## 当前机器直接启动

项目位于 `outputs/wuyishan-map-phase1`。本次已在同一工作区的 `work/runtime/pgsql` 准备独立 PostgreSQL 17.6 / PostGIS 3.6.2，数据在 `work/pgdata`，监听 127.0.0.1:55432；没有注册系统服务。`.env` 已在本机生成，包含随机数据库密码和管理员令牌，未加入交付压缩包或版本控制。

在项目目录运行：

```powershell
./scripts/start-local.ps1
```

浏览器打开 `http://127.0.0.1:5173/places`，输入项目 `.env` 中的 `ADMIN_TOKEN`。无需再导入一遍。本脚本依赖本次工作区的独立运行时；迁到其他机器请按下面步骤配置。停止本脚本启动的服务：`./scripts/stop-local.ps1`，数据库文件保留。

也可分别在两个终端运行 `pnpm dev:api` 与 `pnpm dev:admin`，用 Ctrl+C 停止。不要与已经监听同一端口的实例同时启动。

## 新机器启动（Docker 或现有 PostgreSQL）

需要 Node.js 22+、pnpm，以及 PostgreSQL 17+ / PostGIS。仓库包含锁文件，安装依赖使用固定解析结果。

```powershell
pnpm install --frozen-lockfile
node scripts/init-env.mjs
docker compose up -d db
pnpm db:migrate
pnpm import:preview
```

`init-env.mjs` 生成随机密码和管理令牌；已有 `.env` 会拒绝覆盖。Docker 镜像为 `postgis/postgis:17-3.5`，绑定本地 5432；本次实际验证另用上述 Windows 17.6 / 3.6.2 运行时，未在本机运行 Docker。使用已有 PostgreSQL 时自行把 `.env` 的 DATABASE_URL 指向准备好的独立数据库，然后跳过 Docker 命令。建表账号需要 CREATE EXTENSION 权限。

预览文件在 `reports/import-preview.md` 与 `.json`，核对后执行：

```powershell
pnpm import:apply --preview reports/import-preview.json
pnpm db:check
pnpm dev:api
# 另一个终端
pnpm dev:admin
```

自定义源文件：

```powershell
pnpm import:preview --file "源文件完整路径.xlsx" --out reports/new-preview.json
pnpm import:apply --file "源文件完整路径.xlsx" --preview reports/new-preview.json --out reports/new-result.json
```

只接收 V1.2 工作表及表头约定；Excel 中路线时长需明确分钟/小时单位。预览和提交间源文件或数据库发生变化，需要重新预览。单行失败会保留错误明细并继续后续行；已有业务编号跳过，不能默认覆盖。

## 检查与构建

```powershell
pnpm build
pnpm test
pnpm test:integration
pnpm db:check
pnpm exec tsx tests/browser-check.ts
```

集成测试需要当前数据库账号具有 CREATEDB 权限；自动创建随机名称的独立测试数据库并删除该测试库，不把错误样本导入实际数据。浏览器检查需要先启动 API/管理端，Windows 默认使用已安装的 Edge；其他平台设置 `BROWSER_CHANNEL=chrome` 并安装 Chrome，或调整 Playwright 启动配置。测试生成的 Excel 仅在工作区 `work/` 内。

## 备份与恢复

`database/seed/phase1-full.sql` 是本次真实数据库的结构和数据快照，包含 46 个地点、原始行审计、迁移版本，不含管理员令牌或数据库用户密码。可以将其恢复到一个全新空库：

```powershell
psql -h 127.0.0.1 -p 5432 -U wymap -d new_empty_database -v ON_ERROR_STOP=1 -f database/seed/phase1-full.sql
```

恢复完整快照与“执行迁移后导入 Excel”是两种初始化方式，不要在同一已建表数据库叠加执行快照。新库必须安装 PostGIS。自助备份可使用 `pg_dump --no-owner --no-privileges`，连接参数通过本机安全配置提供。

## 接口

|接口|说明|
|---|---|
|GET /health|数据库连通检查|
|GET /api/admin/options|管理员筛选选项|
|GET /api/admin/places|管理员地点列表；q、region、category、tag、priority、status、public_level、coordinate、freshness、sort、page、page_size|
|GET /api/admin/places/:code|管理员详情，业务编号定位；包含父子、原始坐标/候选、实用信息、实际核验历史、路线和攻略|
|GET /api/places|未来正式接口的安全投影契约；本阶段没有游客页面|
|GET /api/places/:code|安全投影详情；P5 返回 404，P2—P4 不带精确坐标，未确认/非正常地点不带导航坐标|

管理员接口使用 `Authorization: Bearer <ADMIN_TOKEN>`，本阶段只读。Excel 导入由受控本地 CLI 执行，未增加文件上传服务或额外管理页面。确认坐标写回、编辑地点、现场采集、路线管理页面均未实现。

更多内容见 `database/README.md`、`reports/阶段报告.md`、`reports/数据异常清单.md`。
