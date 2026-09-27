# 武夷山奶爸地图 MVP 开发规格 V1

## 1. 产品目标

建立一个“地图 + 地点 + 攻略 + 路线 + 实地核验”统一系统。第一阶段只做内部原型，目标不是面向游客完整上线，而是验证：

1. 地点数据模型是否够用；
2. 现场录点是否足够快；
3. 地图是否能直观管理父子点位；
4. 路线能否由地点直接组合；
5. Excel 与 DJI/GPS 数据是否能批量迁移；
6. 后续是否能平滑接入微信、抖音、小红书。

## 2. MVP 范围

### 必须实现

- 地图总览
- 地点列表
- 地点详情
- 新建 / 编辑地点
- 手机当前位置采集
- 父子点位关系
- 分类与标签筛选
- 地点状态与公开等级
- 实地核验记录
- 路线创建与站点排序
- Excel 首次导入
- 坐标候选导入与人工确认
- 数据导出备份

### 暂不实现

- 游客注册登录
- 收藏
- 评论
- 社区
- 支付
- 订单
- 酒店/门票预订
- 会员体系
- 推送
- 复杂推荐算法
- 微信/抖音/小红书正式发布

## 3. 技术路线

### 总体架构

- 管理端：响应式网页，手机和电脑都能使用
- 前端：Vue 3 + TypeScript + Vite
- 后端：Node.js + TypeScript
- 数据库：PostgreSQL + PostGIS
- 图片/文件：对象存储
- 地图：使用合规地图服务商底图；第一版优先腾讯地图
- 后续多端：统一接口层，微信/抖音/小红书只做前端适配

### 原则

1. 线上数据库上线后，成为唯一主数据库。
2. Excel 只用于首批迁移、批量导入、导出备份。
3. 所有外部坐标先进入候选区，不直接覆盖正式地点坐标。
4. 地图服务商只负责底图、定位和路线能力；业务点位由自有数据库管理。

## 4. 核心数据对象

### 4.1 地点 places

核心字段：

- id：系统唯一编号
- code：业务编号，如 WY-0024
- name：名称
- short_name：简称
- place_type：主地点 / 辅助点 / 服务点 / 风险点等
- parent_place_id：上级地点
- category_id：主分类
- tags：标签
- region：所属区域
- main_line：所属主线
- intro：简介
- current_status：正常 / 临时关闭 / 季节关闭 / 施工 / 道路中断 / 不建议前往 / 永久关闭 / 待核实
- public_level：P1-P5
- priority：高 / 中 / 低
- created_at
- updated_at

### 4.2 坐标 place_coordinates

- place_id
- raw_latitude
- raw_longitude
- raw_coordinate_system
- source_type：手机 / DJI / GPS / 地图点选 / 手工导入
- source_file
- source_time
- accuracy_meters
- confidence_level：A-D
- map_latitude
- map_longitude
- map_coordinate_system
- conversion_method
- human_confirmed
- confirmed_at
- confirmed_by

原则：正式地点只读取 human_confirmed=true 的地图坐标。

### 4.3 实用信息 place_practical_info

- place_id
- car_access
- road_type
- road_width_note
- passing_difficulty
- four_wheel_drive_required
- walking_required
- walking_distance_m
- walking_duration_min
- parking_available
- parking_type
- parking_capacity_note
- parking_fee_note
- toilet_available
- toilet_distance_m
- food_available
- water_available
- mobile_signal_note
- charging_available

### 4.4 亲子与老人信息 place_accessibility

- stroller_friendly
- baby_carrier_possible
- age_2_3_rating
- age_4_6_rating
- age_7_plus_rating
- elderly_friendly
- stairs_note
- slope_note
- shade_note
- seats_available
- fall_risk
- water_risk
- vehicle_risk

### 4.5 自然观察 place_nature

- place_id
- primary_observation
- secondary_observation
- best_season
- best_time
- weather_note
- wind_note
- temperature_note
- guaranteed_sighting：否为默认
- waiting_required
- ecological_sensitivity

### 4.6 水域信息 place_water

- place_id
- water_type
- normal_depth_note
- riverbed_type
- slippery_risk
- current_risk
- rainfall_risk
- upstream_rainfall_risk
- child_water_entry_note
- life_jacket_note
- last_water_check_at

### 4.7 实地核验 verifications

每次核验保留历史，不覆盖旧记录。

- id
- place_id
- verified_at
- road_status
- parking_status
- toilet_status
- open_status
- weather
- water_condition
- observation_note
- photo_ids
- general_note
- verifier

### 4.8 路线 routes

- id
- code
- name
- route_type
- intro
- total_duration_min
- estimated_driving_min
- estimated_walking_m
- suitable_age_note
- season_note
- rain_friendly
- elderly_friendly
- publish_status

### 4.9 路线站点 route_stops

- route_id
- place_id
- sequence
- suggested_duration_min
- required_or_optional
- alternative_group
- condition_note

支持未来：晴天走 B，雨天换 C。

### 4.10 攻略 guides

- id
- code
- title
- summary
- body
- guide_type
- publish_status
- published_at
- updated_at

### 4.11 攻略地点关系 guide_places

允许一篇攻略关联多个地点，一个地点关联多篇攻略。

### 4.12 媒体 media

- id
- place_id
- media_type
- purpose：环境 / 停车 / 岔路 / 厕所 / 风险 / 展馆 / 观察记录等
- file_url
- local_source_path
- shot_at
- direction_note
- public_status

### 4.13 坐标候选 coordinate_candidates

- id
- source_file
- source_time
- raw_latitude
- raw_longitude
- raw_coordinate_system
- matched_place_id
- match_confidence
- match_reason
- converted_latitude
- converted_longitude
- human_confirmed
- rejected_reason

## 5. 页面结构

### 5.1 地图页 `/map`

顶部：
- 搜索框
- 分类筛选
- 状态筛选
- “只看待核验”
- “只看缺坐标”

地图行为：
- 缩小时显示区域与主地点
- 放大后显示辅助点
- 同一父地点的子点默认不全部展开
- 点击地点显示底部卡片
- 卡片可进入详情
- 不同状态使用明显视觉区分

底部卡片最少显示：
- 名称
- 分类
- 当前状态
- 坐标是否确认
- 最后核验时间
- 公开等级
- 编辑按钮

### 5.2 地点列表 `/places`

筛选：
- 名称
- 区域
- 分类
- 标签
- 优先级
- 状态
- 公开等级
- 坐标状态
- 核验新鲜度

支持排序：
- 最近更新
- 最久未核验
- 高优先级优先
- 缺坐标优先

### 5.3 地点详情 `/places/:id`

模块顺序：
1. 基本信息
2. 地图位置
3. 子地点
4. 实用信息
5. 亲子/老人
6. 自然观察或水域信息
7. 最新核验
8. 历史核验
9. 关联攻略
10. 关联路线
11. 媒体
12. 编辑日志

### 5.4 新建/编辑地点 `/places/new` `/places/:id/edit`

现场快速模式只要求：
- 名称
- 当前坐标
- 分类
- 一句话备注
- 公开等级

其余字段可稍后补充。

### 5.5 现场核验 `/places/:id/verify`

手机优先。

字段：
- 自动读取当前位置
- 当前开放状态
- 道路
- 停车
- 厕所
- 水情（若适用）
- 天气
- 照片
- 备注

提交后：
- 新增一条核验记录
- 不删除旧记录
- 更新地点“最后核验时间”缓存字段

### 5.6 路线管理 `/routes`

支持：
- 新建路线
- 搜索地点加入
- 拖拽排序
- 设置每站停留时间
- 设置必选/可选
- 设置替代组
- 在地图中预览整条路线

### 5.7 坐标候选 `/coordinates/candidates`

列表展示：
- 来源文件
- 时间
- 原始坐标
- 候选地点
- 匹配置信度
- 地图预览

操作：
- 确认写回
- 改绑其他地点
- 拒绝
- 标记“只作轨迹参考，不作为游客点位”

## 6. 关键业务规则

### 6.1 坐标规则

- P1：可显示精确坐标并导航
- P2：公开时只显示模糊区域，后台保留精确坐标
- P3：只显示区域级位置
- P4：攻略可见，不显示位置
- P5：完全私有

### 6.2 核验新鲜度

建议默认：
- 0-90天：新鲜
- 91-180天：建议复核
- 181天以上：已过期
- 无记录：待核验

水域、道路、临时开放状态以后可设置更短周期。

### 6.3 父子点位

- 主地点可以有多个辅助点
- 地图缩放不足时只显示父地点
- 子地点不能因为父地点公开而自动公开
- 子地点独立拥有公开等级与坐标可信度

### 6.4 动植物敏感点

- 精确位置可存后台
- 默认不得自动公开
- 珍稀物种、巢穴、脆弱栖息地应至少 P2/P3，必要时 P4/P5

### 6.5 封闭地点

地点不删除。
- 状态改为关闭/施工/不建议前往
- 可保留历史攻略
- 关闭导航按钮
- 显示最后核验时间

## 7. Excel V1.2 首次迁移规则

目标文件：`武夷山奶爸地图_主数据库_V1.2.xlsx`

迁移顺序：
1. 分类标签
2. 地点库
3. 路线库
4. 攻略库
5. 实地核验
6. 坐标候选匹配
7. 待核验任务只作为迁移辅助，不进入长期核心数据模型

导入器要求：
- 支持预览
- 显示错误行
- 不因单行错误中断全批次
- 按业务编号去重
- 已存在地点默认不覆盖，除非显式选择更新
- 导入完成生成报告

## 8. DJI / GPS 坐标导入规则

处理链：
1. 读取文件名
2. 读取拍摄/字幕时间
3. 提取原始经纬度
4. 识别原始坐标系
5. 写入 coordinate_candidates
6. 根据时间、文件主题、已有地点区域生成候选匹配
7. 转换为地图坐标
8. 在地图中显示轨迹与候选点
9. 人工确认
10. 写回正式地点坐标

严禁：
- 无人机位置直接当作停车点
- 无人机空中位置直接当作游客位置
- 自动覆盖人工确认坐标

## 9. 权限

MVP 只需要一个管理员账号。

角色：
- owner：全部权限

未来再扩展：
- editor：编辑内容
- field_collector：只能新增现场核验和候选点
- viewer：只读

## 10. 应用程序接口（API）草案

### 地点
- GET `/api/places`
- GET `/api/places/:id`
- POST `/api/places`
- PATCH `/api/places/:id`
- GET `/api/places/:id/children`

### 核验
- GET `/api/places/:id/verifications`
- POST `/api/places/:id/verifications`

### 路线
- GET `/api/routes`
- POST `/api/routes`
- GET `/api/routes/:id`
- PATCH `/api/routes/:id`
- PUT `/api/routes/:id/stops`

### 坐标候选
- GET `/api/coordinate-candidates`
- POST `/api/coordinate-candidates/import`
- POST `/api/coordinate-candidates/:id/confirm`
- POST `/api/coordinate-candidates/:id/reject`

### 导入导出
- POST `/api/import/excel`
- GET `/api/export/excel`

## 11. MVP 验收标准

达到以下条件即可认为内部原型可用：

1. V1.2 的 46 个候选地点成功导入。
2. 地图可以显示所有有坐标的地点。
3. 可按分类、状态、优先级、坐标状态筛选。
4. 手机可以新建一个地点并采集当前位置。
5. 可以为地点新增一条实地核验记录。
6. 父地点和子地点关系正确显示。
7. 可以建立一条不少于 5 个站点的路线并拖拽排序。
8. 可以导入一批坐标候选，并逐条人工确认。
9. P2-P5 地点不会因为前端逻辑错误泄露精确坐标。
10. 可以完整导出数据库备份。

## 12. 开发顺序

### 第 0 阶段：项目骨架
- 建仓库
- 前后端基础工程
- 数据库
- 登录保护
- 基础部署

### 第 1 阶段：数据模型 + Excel 导入
- 建表
- 数据迁移脚本
- 导入 V1.2
- 数据校验

### 第 2 阶段：地点管理
- 地点列表
- 地点详情
- 新建/编辑
- 父子关系
- 筛选

### 第 3 阶段：地图
- 地图显示
- 标记点
- 状态区分
- 父子点展开
- 当前定位

### 第 4 阶段：实地核验
- 手机核验页
- 拍照
- 历史记录
- 新鲜度计算

### 第 5 阶段：路线
- 路线 CRUD
- 站点排序
- 地图预览

### 第 6 阶段：坐标导入
- Excel/CSV
- SRT/GPS 解析
- 候选匹配
- 人工确认

### 第 7 阶段：内部测试
- 用一号风景道完整走一遍
- 现场新增/核验 10 个点
- 修正字段和交互

## 13. Codex 第一阶段任务指令

请先不要一次性开发完整产品。

第一阶段只完成：

1. 创建前后端项目骨架；
2. 建立 PostgreSQL/PostGIS 数据库模型；
3. 实现 places、place_coordinates、verifications、routes、route_stops、guides、media、coordinate_candidates 八组核心表；
4. 编写 Excel 导入脚本，读取《武夷山奶爸地图_主数据库_V1.2.xlsx》；
5. 提供导入预览和错误报告；
6. 建立地点列表与地点详情两个最简单页面；
7. 不实现地图、不实现多平台、不实现游客端。

完成后必须提供：
- 数据库结构说明
- 数据迁移脚本
- 本地启动说明
- 测试数据导入结果
- 已知问题列表

在第一阶段验收前，不进入地图和路线页面开发。
