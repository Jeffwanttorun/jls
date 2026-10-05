# 等待服务器配合：V6 后台部署

## 当前 Production Baseline

**`32b5ce20b8fca132b5fd7ffdee06c87b9396a6d2` / `32b5ce2`**。

这是本轮明确保留的生产基线。2026-10-05 用户要求停止全部生产操作，因此本轮没有访问生产服务器、触发发布、迁移生产数据库、覆盖后台文件或推送 GitHub。朋友服务器每五分钟检查 GitHub 更新，在重新获得部署授权前不推送这批本地提交。

## 已知生产后台现状（先前核查，非本轮实时状态）

2026-10-01 核查记录：公开网站 `release.json` 服务 `32b5ce2`；后台与管理 API 未登录返回 401，登录后的 V6 `/api/admin/content-studio/state` 和 `/revisions` 返回 404，旧发布状态接口可用。后台仍引用旧 JS `index-DfELFErU.js`、CSS `index-MshfNATi.css`。

API 的实际目录、进程、服务器数据库版本、`011_content_studio.sql` 是否已执行均未获得服务器端证明。不得把公开网站版本正确或旧发布接口成功当成 V6 后台部署成功。详见 `outputs/wuyishan-map-phase1/reports/content-studio-v6/production-backend-audit-20261001.md`。

## 本地版本与数据

本地分支：`codex/v6-local-hardening`。本地改动基于 `32b5ce2`；保留 main 的生产基线，不向 GitHub 推送。本地最新 SHA 以项目根目录 `git rev-parse HEAD` 为准，同时写入不进 Git 的 `work/local-hardening/local-version.json`，记录完成提交后的 SHA、生产基线和验证证据。本地实现提交将在任务完成报告中列明。

本轮：完整 PostgreSQL、API、维护台运行；禁用本地发布；完整 ZIP 导出、预检查、导入到 Draft；草稿预览；路线服务点移动；一键启动/停止/完整备份/恢复；同 Wi-Fi HTTPS。未新增大型功能。

本地已执行 001–011 migration。所有已有 migration 原文保持不变；本轮没有新增 schema migration。**生产待迁移：必须先查服务器 `schema_migrations`；重点核对 `011_content_studio.sql`，其是否待执行不能凭本地状态推断。**如缺更早 migration，应按原有顺序补齐；禁止修改已应用迁移或绕过摘要检查。

本地真实数据未添加测试分组、未自动判断黄村/曹敦/红星归属。测试使用隔离数据库。维护者的后续内容修改应通过完整草稿 ZIP 迁移，不能以仓库 seed 覆盖本地 Draft，也不能用本地整库 SQL 直接覆盖生产数据库。

## 未来服务器执行清单（本轮不执行）

1. 重新获得用户生产部署授权，确认服务器可配合，确认要部署的本地 SHA；停止自动轮询竞争，安排维护窗口。
2. 在服务器确认 repository HEAD、`readlink -f /srv/localdad/source/map`、`systemctl cat localdad-api`。目标项目是 `outputs/wuyishan-map-phase1`。检查 API WorkingDirectory、ExecStart、正在运行的 PID、Nginx 后台静态目录、公开站 release/symlink。目录错误先修正，不执行 migration。
3. 备份生产 PostgreSQL并在临时库恢复验证；另备份旧后台静态文件、服务配置和当前内容快照。没有可恢复备份，不迁移。
4. 安全加载 `/etc/localdad/localdad.env`，只核对必要变量是否存在，不输出 secret。**不要复制本地 `.env`、本地 CA/私钥、开发路径或 `LOCAL_CONTENT_ONLY=1` 到生产。**生产必须保留认证。
5. 在实际目标工作目录安装锁定依赖、执行原 migration、构建后台/API。任何一步失败停止，保留当前生产版本。
6. 部署 `admin/dist` 到已核实的 `/srv/localdad/admin/`，验证 index 中资源名及文件摘要匹配本次构建；重启真实 `localdad-api`，检查新 PID、WorkingDirectory、ExecStart 与日志。
7. 验证未登录仍 401/403；登录后的 V6 State、Places、Routes、Stages/Groups、Themes、Media、Draft、History、Import/Export、Publish 不再 404。验证接口实际读写的数据库和媒体路径。
8. 先导出服务器当前内容；对本地完整 ZIP 做预检查并人工检查版本冲突，再导入为服务器 Draft。导入不能自动发布，先 Preview、检查路线关系与媒体。旧历史副本留在 ZIP，生产当前历史不被覆盖。
9. 在明确授权下验证 `Draft → Preview → Publish → immutable snapshot → build/release → 公网内容断言 → rollback`。记录 CONTENT_REVISION、CONTENT_SNAPSHOT_HASH、实际 deployed commit、服务器文件路径和最终公网页面内容。只看 200、git pull 或 build success 不算完成。
10. 用真实 iPhone Safari 验证登录、搜索、编辑、核验日期、分组选择、照片上传、保存草稿、Preview、键盘、滚动与返回。清理测试内容，重新导出正式备份。
11. 只有服务器本机 HTML 与公网内容断言、后台静态资源和已认证 API 全部通过，才报告完成；之后再恢复自动部署轮询。

## 本地验收与仍需真机确认

- 38 项既有测试通过；新增真实 PostgreSQL/API 测试验证导出到新数据库导入的一致性、图片、Draft/公开快照隔离、损坏包拒绝、并发版本冲突与历史恢复。
- 完整本地备份在空库恢复并核对 24 张表，通过；原数据库不覆盖。
- Chromium 与 WebKit 的 375/390px 浏览器验证实际 API 的分组、移动、编辑、上传及本地预览；证据保留 `work/local-hardening/tests/`。
- 当前 Wi-Fi `192.168.2.178`；维护台 `https://192.168.2.178:5173/studio`。手机需信任现有本机根证书。
- 本轮没有可操控的真实 iPhone。真机联网、证书安装、软键盘、手机相册及 Safari 返回仍需维护者测试，不用模拟测试替代。Windows 更窄的防火墙规则需管理员权限；已有 Node 专用网络规则仍存在。
