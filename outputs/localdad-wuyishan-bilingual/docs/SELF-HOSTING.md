# 朋友服务器上的完整部署方式

这份方案用于朋友提供的子域名。公开网站、维护后台和发布程序使用同一个子域名：

- 公开网站：`https://子域名/`
- 维护后台：`https://子域名/admin/`

后台受 Nginx Basic Auth 和应用层密码双重保护。公开网站保持静态文件，因此游客访问不会直接连接 PostgreSQL，也不能调用维护接口。

## 服务器目录

```text
/srv/localdad/source/site       整合后的 Local Dad 网站源码
/srv/localdad/source/map        奶爸地图后台和 API 源码
/srv/localdad/data              可变内容和上传图片
/srv/localdad/releases          每次成功发布生成一个不可变版本
/srv/localdad/releases/current  Nginx 当前展示的版本链接
/srv/localdad/backups           内容、图片和发布前备份
/srv/localdad/admin             构建后的维护后台
```

源码更新不会覆盖 `/srv/localdad/data`、`/srv/localdad/backups` 或历史 release。

## 第一次部署

1. 安装 Node.js 22、pnpm、PostgreSQL、Nginx 和 `htpasswd`。
2. 建立专用的 `localdad` 系统用户，不使用 root 运行网站程序。
3. 把两个源码目录放入 `/srv/localdad/source/`。
4. 把当前 `visitor-content-store/data.json` 和 `media/` 复制到 `/srv/localdad/data/visitor-content/`。
5. 将 `deploy/localdad.env.example` 复制为 `/etc/localdad/localdad.env`，只在服务器填写真实密码与子域名。
6. 使用同一个后台密码创建 `/etc/localdad/admin.htpasswd`；用户名可以设置为 `jeff`。
7. 在 map 项目中安装依赖并构建后台：`ADMIN_BASE_PATH=/admin/ pnpm build`，把 `admin/dist/` 复制到 `/srv/localdad/admin/`。
8. 安装并启用 `deploy/localdad-api.service`。
9. 在 site 项目执行 `pnpm site:publish`。只有完整构建和路线保护检查通过后，`current` 才会指向新版本。
10. 根据 `deploy/nginx-subdomain.conf.example` 配置子域名和 HTTPS。

## 日常维护

1. 登录 `/admin/`。
2. 直接选择首页、主题、内容或地点图片，完成缩放和裁剪。
3. 修改游客内容或主题关系。
4. 点击“更新公开网站”。
5. 后台先备份内容，再运行完整构建。成功后切换网站；失败时继续展示原来的版本。

## 恢复上一版

每个 `/srv/localdad/releases/<时间>/release.json` 都记录游客内容版本和地图哈希。选择已知正常的 release 后执行：

```bash
cd /srv/localdad/source/site
pnpm site:rollback -- 2026-09-25T00-00-00-000Z
```

回退只切换公开网站，不删除新版本或修改内容数据。

## 备份

`publish-site.mjs` 在每次发布前自动备份游客内容 JSON 和所有游客图片。`deploy/backup-localdad.sh` 额外备份第二阶段数据库；建议朋友通过 systemd timer 或 cron 每天运行一次，并把至少一份副本保存到服务器之外。

## 数据边界

- 主题、游客内容和图片保存在游客内容存储层。
- 正式地点、坐标和第二阶段 22 张表继续保存在 PostgreSQL。
- 发布过程只读取正式地点及坐标，不写入 PostgreSQL。
- 一号风景道仍使用受保护的 6 段、952 个路线点。构建和发布都会检查它没有被改写。
- `.env`、数据库密码、后台密码、证书和数据库备份不能上传到 GitHub。
