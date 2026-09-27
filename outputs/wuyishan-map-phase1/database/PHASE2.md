> 2026-09-09 最新更新：已增加删除定位（仅撤销并保留历史）、编辑名称及历史名称检索，应用 008/009 迁移。最新结果和已知限制以[后台自助维护验收报告](../reports/phase2/后台自助维护_验收报告_20260909.md)为准；下文较早报告保留为阶段记录。

<!-- corridor-v1 update -->
> 2026-09-09 更新：本次一号风景道整理已落库，61 条档案（60 当前地点、1 重复档案）、58 已排、2 待排。新增006/007迁移；列表和连续判点按路线顺序。最新结果以[本次落库报告](../reports/phase2/一号风景道数据整理_落库报告_20260909.md)为准；下文旧数量为此前阶段记录。集合显示角色仅预览，尚未赋值。

# 第二阶段坐标数据库说明

2026-09-08 增加卫星判点与独立位置确定度。现有来源等级、历史、实地核验和公开投影规则保持原含义。

## 迁移文件

- `003_coordinate_history.sql`：来源类型与引用、候选审核、正式坐标历史、唯一有效坐标索引、历史保护触发器及安全视图。
- `004_coordinate_audit_integrity.sql`：新增审核时间有限值约束和精度有限值约束。
- `005_position_certainty.sql`：候选与正式坐标增加可空 position_certainty，允许 certain / approximate / uncertain；旧记录保留NULL，新字段同样不可改写，正式记录必须复制候选确定度。
- 第一阶段 `001_initial.sql` / `002_integrity.sql` 保持原文件；旧业务编号及关系继续生效。

迁移由事务执行并记录 SHA256。003 在交付前的开发验证中修正了“延迟外键尚未结算就建索引”的顺序问题；先执行约束检查，再完成 DDL。实际库坐标表为空，校验后同步了未发布迁移的开发校验和，过程见 `reports/phase2/draft-migration-correction.json`。此修正不改变表结构或原始业务数据。交付后应新增迁移，不能改动已发布迁移文件或手动跳过摘要检查。

## 字段和生命周期

|对象|关键字段与行为|
|---|---|
|places|仍以 UUID 为内部关系键，WY-xxxx 业务编号唯一、不可修改，父子关系不变|
|coordinate_candidates|所有新观察先入此表，status=pending、human_confirmed=false；审核为 confirmed 或 rejected，保留原始记录，禁止删除与更改观察载荷|
|place_coordinates|每次确认插入一条新记录，引用 candidate_id；status 为 active / superseded / revoked，原经纬度、来源等载荷不允许修改|
|两张坐标表|raw_latitude / raw_longitude / raw_coordinate_system 保留原值；候选 converted_latitude / converted_longitude、正式 map_latitude / map_longitude 分别保存地图转换结果；地图坐标系单独记录|
|来源|source_type：phone_gps / map_click / manual_input / dji_srt / gps_track / imported_file / other；source_reference 可选说明，不依赖文件；source_file 只保留兼容旧导入，允许空|
|位置确定度|position_certainty：certain 确定 / approximate 大致位置 / uncertain 不确定，NULL未记录；原 confidence_level 的A—D按来源依据定义保留，新地图判点记C，不自动升级为A|
|精度与可信度|accuracy_meters 非负且有限；未知为 NULL 并附 accuracy_note，不用 0 冒充精确；confidence_level 沿用原有枚举，人工确认与可信等级独立|
|时间与审计|source_time 采集时间，created_at 入库时间，confirmed_at / confirmed_by 人工确认审计；候选 reviewed_at / reviewed_by，正式 status_changed_at、revoked_at / revoked_by / revocation_reason|
|替换关系|superseded_by 指向替换后的正式记录，外键延迟检查允许同事务插入与替换；每个候选最多一条正式记录，每个地点最多一条 active|

所有数据库时间为带时区类型；旧来源缺失时间保留 NULL，不伪造。新采集接口要求带时区 ISO 8601 source_time；地图点选取点击时刻，手机取浏览器 position.timestamp，手工输入取提交时刻。confirmed_at 在人工确认前必然为空。

人工确认事务先锁定地点，检查界面审核时的 expected_current_id，然后审核候选并写入正式历史。触发器自动将旧 active 设为 superseded；冲突返回 409，候选保留 pending，要求刷新核对。重复确认幂等返回原记录，不复活旧历史。拒绝和撤销必须填写原因。撤销 active 后不回退到旧 superseded。

旧表中缺少候选引用的正式记录在升级时补建带 LEGACY- 前缀的来源追溯候选，复制原值与原审核凭证，不编造新的采集或人工确认。未确认旧正式行转为 revoked，已确认多条仅最新 active；原 ID 和载荷保留。此兼容路径由含三条旧坐标的独立升级测试验证。本次实际库没有这些旧坐标。

## 坐标系

浏览器 GPS 保留 WGS84，腾讯地图点选保留 GCJ-02。卫星判点记录 source_type=map_click、source_reference=腾讯卫星影像人工判读，精度未知不填伪造值。卫星候选经人工确认可成为正式坐标；任何坐标操作均不自动新增或修改实地核验记录。手工输入允许 WGS84 / GCJ-02 / BD-09 / 未知；未知只能待核验，不能确认正式坐标。

地图转换使用固定版本 [gcoord 1.0.7](https://github.com/hujiulong/gcoord)，另存转换结果和 conversion_method；原始观察不被替换。转换结果仅用于内部显示，未经现场核验不作精度承诺。DJI 与轨迹来源可保存，但本阶段不解析 DJI 文件或自动匹配地点，也不把设备位置自动当作地点入口。

## 接口

2026-09-08 起所有 `/api/admin/` 接口采用内部局域网无认证模式。确认人仍由服务器记为既有 `owner`，不接受客户端伪造确认字段；该固定标记不能证明实际操作者身份。没有新增人员或账户体系，数据库结构及坐标事务未改动。

当前采用“内部局域网无认证模式”，仅用于本地/家庭局域网内部管理和现场测试，不适用于公网部署。未来公网部署前必须恢复身份认证和访问控制。

|方法与地址|行为|
|---|---|
|GET /api/admin/coordinate-queue?after=WY-xxxx|返回无有效正式坐标的总数与下一地点（编号排序，末尾绕回，排除当前地点）；不写数据、不生成标记|
|GET /api/admin/places/:code|基本信息、当前与历史坐标、候选、核验、父子和关联数据|
|POST /api/admin/places/:code/coordinate-candidates|latitude、longitude、coordinate_system、accuracy_meters（未知传 null）、source_type、source_time；可选 source_reference、notes、position_certainty；只新建 pending|
|POST /api/admin/places/:code/coordinate-candidates/:id/confirm|expected_current_id（UUID 或 null）、acknowledged=true；确认及替换同事务完成|
|POST /api/admin/places/:code/coordinate-candidates/:id/reject|reason，拒绝 pending 候选|
|POST /api/admin/places/:code/coordinates/:id/revoke|reason，撤销 active 正式坐标|
|GET /api/admin/map-config|管理员地图供应商配置，不提供到公开接口|
|GET /api/admin/map-places|category、region、status、public_level、coordinate_status 筛选，仅返回人工确认的 active 地图坐标；提供祖先业务编号链|

地图坐标状态可选 active、active_with_pending；选择 pending / superseded / revoked 返回空地图点，不显示这些观察或历史。低于 14 级缩放时，如筛选后的数据中有有效祖先，则隐藏其后代；14 级起展开子地点。父地点无有效坐标或被筛选掉时，子地点仍可显示，避免无故消失。

公开接口继续使用字段白名单与安全 SQL 视图：P2—P4 经纬度为空，P5 不返回记录；只有 P1、正常、人工确认且 active 的坐标可进入原有公开契约。所有候选、原始来源、历史记录仅经内部接口提供；内部接口现无认证，可达后台的局域网设备能读取，因此公开接口保护不能代替内部接口的网络隔离。该契约用于安全回归，没有新增游客页面或正式导航服务。
> 2026-09-09 最新更新：新增 `010_place_recycle_bin.sql`，以软删除和不可篡改审计支持网页回收站。删除地点不修改任何坐标、名称、排序或路线历史；公开投影排除回收站地点。详见[验收报告](../reports/phase2/地点删除与回收站_验收报告_20260909.md)。
> 2026-09-09 补充：父地点删除可在同一事务中解除直接子地点父级或转移至合法新父地点；服务器排除当前地点及全部后代，恢复父地点不回改子地点。数据库结构仍为 010 迁移，详见[验收报告](../reports/phase2/父地点删除子地点处理_验收报告_20260909.md)。
