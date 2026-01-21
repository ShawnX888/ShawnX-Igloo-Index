# Reuse Digest — 行政区域边界与选区交互

> 状态：Draft  
> Reuse Type：R1（复用但重构）  
> Target Home：FE + Shared Contract  
> 绑定验收锚点：L0/L1、Perf/SLO（hover 0 重请求）、Shared Contract、Observability

---

## 1. v1 输入材料（仅作线索，禁止当真源）

- `docs/v1/11-行政区域边界绘制.md`
- （关联依赖）`docs/v1/05-行政区域数据管理.md`、`docs/v1/25-矢量地图动画切换.md`

---

## 2. 可复用逻辑与要求（完整重述）

### 2.1 双数据源设计（可复用的核心思想）
v1 强调：
- **Google 名称**用于 UI 下拉与外部 API（展示友好）
- **GADM 数据**用于边界渲染、中心点、GPS 定位归属（GIS 准确）
- 通过映射表与转换函数实现 Google ↔ GADM 的名称转换

### 2.2 边界渲染策略
- 使用 Google Maps Data Layer 加载 GeoJSON FeatureCollection。
- Feature properties 保留 Google 名称用于 UI 展示与交互回传。
- 坐标转换：从 {lat,lng} 转 GeoJSON 的 [lng,lat]，并确保 polygon 闭合。

### 2.3 样式规则（与热力图图层协同）
v1 给出了明确的“填充/边框”规则：
- 未选中：填充透明；边框低对比
- 选中：
  - 热力图可见：填充透明（让热力图透出），边框高亮
  - 热力图不可见：蓝色高亮填充 + 高亮边框

### 2.4 交互规则
- click：切换选中区域（回传 Region）
- hover：边框高亮
- 选中后可触发 fly-to/fitBounds 的视角更新（v1 有动画系统集成的想法）

---

## 3. v2 化适配（必须写清楚）

### 3.1 从“名称映射”升级为“编码契约”
v2 必须避免把自由文本名称当主键：
- 映射目标优先是 **region_code**（稳定编码）+ region_scope
- display_name 只用于 UI
- 映射/回传必须可观测（命中哪个映射规则）

### 3.2 hover 轻交互红线（v2 强制）
hover 只能做：
- 边界高亮
- mini tooltip（≤3 指标，且来自已加载/缓存命中数据）

禁止：
- hover 触发 L1/L2 明细请求
- hover 导致排行榜/时间轴重算风暴

### 3.3 与数据产品的协作边界
- click lock / Pareto Click 才允许触发 L1 最小集刷新
- “AI Insight Click / AI CTA” 才触发 L2（按 Mode 裁剪）

### 3.4 可观测性
边界交互至少记录：
- map_hover（region_code?）/ map_lock（region_code）/ dp_l1_query / ui_render_done
- 必带字段：trace_id + access_mode + region_code + time_range + data_type + weather_type + product_id + prediction_run_id（predicted）

---

## 4. 验收用例（必须）与反例（禁止）

### 4.1 验收用例（Acceptance）
- [ ] 边界可渲染、hover 高亮、click 可锁定选区并回传稳定标识（region_code 或可推导的稳定标识）。
- [ ] 选中/未选中样式规则与“热力图可见性”协同工作，不互相遮挡。
- [ ] hover 不触发 L1/L2 明细重请求（0 重请求），且边界更新在可感知的低延迟内完成。

### 4.2 反例（Non-examples / Forbidden）
- [ ] 禁止：把 district/province 文本作为唯一标识写入状态与缓存 key。
- [ ] 禁止：在边界层里做数据聚合或拉取明细（应由数据产品提供）。

---

## 5. 未决问题（Open Questions）
- Q1：region_code 的编码体系与边界数据源（GADM code 还是自研 code）需要在 v2 Shared Contract 固化。

