# Reuse Digest — GPS 定位与反向地理编码/行政区解析

> 状态：Draft  
> Reuse Type：R1（复用但重构）  
> Target Home：FE + BE + Shared Contract  
> 绑定验收锚点：L0/L1、Compliance、Perf/SLO、Shared Contract、Observability

---

## 1. v1 输入材料（仅作线索，禁止当真源）

- `docs/v1/16-GPS定位功能.md`
- （关联依赖）`docs/v1/10-地图容器替换.md`、`docs/v1/05-行政区域数据管理.md`、`docs/v1/25-矢量地图动画切换.md`

---

## 2. 可复用逻辑与要求（完整重述）

### 2.1 GPS 获取（浏览器侧）
- 使用浏览器 Geolocation API 获取 lat/lng。
- 必须处理失败分支：
  - 不支持
  - 用户拒绝
  - 超时
  - 位置不可用
- 需要明确超时与精度策略（v1 给出 enableHighAccuracy + timeout=10s）。

### 2.2 Reverse Geocoding（反向地理编码）
- 使用 Google Geocoding API 的 Reverse Geocoding：
  - lat/lng → address components
  - 提取行政层级：country、administrative_area_level_1（省/州）、administrative_area_level_2 或 locality（市/区）

### 2.3 行政区解析的“双重验证机制”（v1 的关键可复用逻辑）
目标：在“Google 返回名称”与“本地 GADM 边界/中心点数据”之间做稳健匹配。

流程（v1）：
1) **地理预过滤**：计算 GPS 坐标到所有“预存行政区中心点（GADM Centers）”的距离，取最近 3–5 个候选
2) **语义匹配**：用 Geocoding 返回名称与候选的 GADM 名称、以及 Google 映射名做比对
3) **兜底策略**：若语义匹配失败，按“就近原则”取最近候选
4) **一致性约束**：最终返回区域必须存在于系统的区域层级（v1 表述为 `REGION_HIERARCHY`）

### 2.4 UI 交互与状态反馈
- 地图控制区域提供定位按钮（靠近图层控制）。
- 定位状态必须清晰：idle/loading/success/error，并给出错误提示。
- 定位成功后触发地图视图更新，且动效需平滑（v1 甚至定义“两阶段动画序列”思想：先定位到 GPS 点，再回到区域全景中心）。

---

## 3. v2 化适配（必须写清楚）

### 3.1 目标闭环：坐标 → 行政区 → region_code → 数据产品刷新
v2 必须把“解析结果”落到统一契约：
- 输出必须包含：
  - region_code（稳定编码，优先）
  - region_scope（province/district）
  - display_name（仅用于 UI）
- 解析成功后的行为必须是：
  - Map lock 选区
  - 触发 L0/L1（以及必要的 Overlays）数据产品刷新
  - 更新 UI Orchestration 的单一事实源（而不是散落多个组件）

### 3.2 Shared Contract：名称/编码映射必须可追溯
GPS/Geocoding 的本质是“把外部世界映射到内部 region_code”，因此必须把映射规则视为 Shared Contract：
- 语义匹配应优先对齐 region_code（而不是仅对齐文本 district/province 名称）
- 兜底策略（就近）必须可观测、可审计（记录选择原因与候选列表概要）

### 3.3 Access Mode 与合规（强制）
定位与地理编码属于高成本/合规敏感能力：
- 必须遵守 Google Maps Platform 的条款（缓存/存储限制、attribution、key 限制与预算监控）
- 必须具备节流/限流与失败降级：
  - 前端防抖：避免重复点击造成 burst
  - 后端限流：保护 Geocoding 配额与成本

### 3.4 性能与缓存（需求级）
- 目标：定位请求（含地理编码）在可接受时间内完成（v1：地理编码 3s 内；可作为 v2 初始目标）。
- 若做缓存：
  - 必须有明确 TTL 与审计（遵守条款）
  - cache key 至少包含 lat/lng（按精度归一化）+ access_mode（若影响输出）+ 版本标识（若映射表会变）

### 3.5 可观测性（必须）
至少要记录：
- gps_click → geolocation_result → reverse_geocode_call → candidate_selection → semantic_match_result → region_selected → map_lock → dp_refresh
- 必带字段：trace_id/correlation_id + lat/lng（可脱敏/降精度）+ region_code + match_strategy（semantic/nearest）+ access_mode

---

## 4. 验收用例（必须）与反例（禁止）

### 4.1 验收用例（Acceptance）
- [ ] 用户点击定位按钮后，能获得 GPS 坐标，并完成反向地理编码与行政区解析，最终得到 region_code（或等价稳定标识）。
- [ ] 解析成功后自动锁定选区并触发 L0/L1 数据刷新，地图视图平滑更新。
- [ ] 解析失败时能够稳定降级：提示错误 + 保持当前选区不变 + 支持重试/手动选择。
- [ ] 语义匹配失败时走“就近兜底”，且日志/埋点记录 match_strategy=nearest。

### 4.2 反例（Non-examples / Forbidden）
- [ ] 禁止：把 Geocoding 返回的自由文本名称当作内部主键（必须映射到 region_code）。
- [ ] 禁止：反向地理编码结果长期存储且无 TTL/无依据（合规风险）。
- [ ] 禁止：用户连续点击造成 Geocoding 请求风暴（必须节流/限流）。

---

## 5. 未决问题（Open Questions）
- Q1：region_code 的最终权威编码体系采用什么（GADM code / 自研 code / mapping table）？需要与边界数据源一致。
- Q2：lat/lng 的精度与日志策略（如何脱敏/降精度以兼顾可观测与隐私）？

