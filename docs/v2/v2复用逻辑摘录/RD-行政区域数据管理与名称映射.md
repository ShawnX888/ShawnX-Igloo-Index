## 模块信息

- **模块名**: 行政区域数据管理与名称映射（Region Data + Mapping）
- **Reuse Type**: R1（思想复用 + v2 编码契约强化）
- **Target Home**: Shared Contract + BE（Region Service/数据准备）+ FE（搜索/选择/展示）
- **绑定验收锚点**: Shared Contract / Observability / Perf-SLO / Compliance

---

## v1 输入材料（仅用于溯源，不得在 v2 文档中直接引用实现）

- `docs/v1/05-行政区域数据管理.md`

---

## 可复用逻辑摘录（v1 语义，不拷贝实现）

### 1) 双数据源：UI 与 GIS 分离

- **Google 名称**：用于 UI 下拉、外部 API（Weather/Geocoding）调用（展示友好）。
- **GADM 数据**：用于边界渲染、中心点、GPS 定位归属判断（GIS 准确）。
- **名称映射**：Google ↔ GADM 的双向转换函数/映射表。
- **合并导出**：提供合并后的层级/映射数据给其他模块消费。

### 2) 区域能力：搜索 + 层级选择 + GPS 转行政区

- 模糊搜索支持国家/省/市（并兼容 Google/GADM 两套名称）。
- 三级层级选择：国家→省/州→市/区（UI 用 Google 名称，内部查询用 GADM 名称）。
- GPS 转行政区采用“双重验证”：
  - 地理预过滤（中心点就近候选）
  - 语义匹配（Geocoding 名称与候选名称/映射名）
  - 兜底：就近优先
  - 输出必须落到系统标准层级集合内

### 3) 性能意识：大文件异步加载与缓存

- GADM 索引/层级文件可能很大，需要异步加载与缓存。
- 搜索与定位要有明确的响应时间目标（v1 给出 500ms/2s/3s 量级目标）。

---

## v2 适配与落地约束（必须按 v2 统一语言表达）

### 0) 关键升级：从“名称映射”升级为“region_code 编码契约”

v2 必须避免以自由文本作为主键：

- **region_code** 是系统内唯一稳定标识（主键/缓存键/权限裁剪/审计都依赖它）。
- `display_name`（无论 Google 还是 GADM）只用于 UI 展示。
- 映射链路必须可追溯：任何一次“名称/坐标 → region_code”的映射都要记录命中策略与版本。

### 1) Shared Contract：必须固化的字段与语义

- `region_code`：稳定编码（必须），并明确编码体系来源（GADM code / 自研 code / mapping table）。
- `region_scope`：至少覆盖 province / district（用于 L0/L1/L2 的层级约束）。
- `country_code`：建议使用 ISO-3166-1 alpha-3 或项目统一的 country_code。
- `region_timezone`：风险地区时区（用于业务边界对齐，见 `RD-时间与时区口径统一.md`）。
- `names`：
  - `google_name`（外部 API/展示友好）
  - `gadm_name`（GIS/数据源对齐）
  - `aliases[]`（可选：同义名/别名）

### 2) 数据组织：把“边界/中心点/层级/映射”拆成可加载单元

为支持多国家扩展与性能控制，建议把区域数据拆分为四类资产：

- `hierarchy`：国家→省→市的结构（用于下拉/层级选择）。
- `centers`：中心点索引（用于就近候选与视角定位）。
- `boundaries`：边界几何（用于渲染与点-in-polygon/可视化）。
- `mapping`：google_name/gadm_name/aliases → region_code 的映射表（带版本）。

要求：

- **按国家分片**：避免一次加载全量。
- **可缓存**：浏览器缓存/后端 CDN/Redis 均可，但必须能按版本失效。

### 3) 查询与选择：统一输出 region_code（而不是名称）

无论入口是：

- 模糊搜索
- 层级下拉
- GPS/Geocoding
都必须输出并驱动系统状态的字段是：

- `region_code`
- `region_scope`
- `display_name`（仅用于 UI）

### 4) 映射决策顺序（v2 必须可解释且可观测）

给定输入（名称或坐标），映射到 region_code 必须遵循确定性顺序：

1. **精确命中**：若输入已携带 `region_code`（例如从 URL state/历史记录恢复），直接使用。
2. **名称映射**：
   - 优先用 `mapping` 表将 `google_name`/`aliases` 映射到 `region_code`；
   - 若有 `gadm_name`，也应可映射到 `region_code`（避免 GIS 数据源名漂移导致断裂）。
3. **坐标推断**（GPS/点选等）：
   - 先用 centers 做地理预过滤拿候选；
   - 再做语义/层级一致性校验；
   - 兜底：就近候选，但必须标注 `match_strategy=nearest`。

> 说明：这一顺序的目标是让“同一输入”在不同端/不同时间得到相同输出，并且能解释为什么得到这个输出。

### 5) GPS 双重验证的 v2 落点（只固化约束，不复制实现）

- GPS/Geocoding 的详细交互与合规约束由 `RD-GPS定位与反向地理编码.md` 负责。
- 本 RD 只补充“区域数据侧”的硬约束：
  - 必须有可用的 centers 索引用于就近候选；
  - 候选集必须能落回 `hierarchy`（系统支持集合）；
  - 映射表必须能覆盖核心 demo 区域的常见别名（避免语义匹配过度依赖外部 API 返回文本）。

### 6) 性能与缓存（必须）

- **搜索**：
  - 建议在 FE 使用本地索引（国家分片后按需加载）或在 BE 提供搜索 API，但输出仍是 region_code；
  - 响应时间目标：p95 < 500ms（初始目标，可随 v2 需求门槛调整）。
- **大文件加载**：
  - boundaries 必须按国家/层级分片，避免一次性加载；
  - 必须有缓存（CDN/浏览器缓存/后端缓存均可），并能按版本失效。
- **版本失效**：
  - mapping/hierarchy/centers/boundaries 任一更新都必须能联动失效；
  - 推荐提供 `region_dataset_version`（或 hash）用于缓存键与观测。

### 7) 可观测性（必须）

区域解析/选择链路至少要记录：

- `region_search`（query → topk candidates）
- `region_select`（source=search|hierarchy|gps|map_click → region_code）
- `region_mapping_hit`（match_strategy=exact|mapping|semantic|nearest）
- `region_dataset_version`

必带字段：

- `trace_id/correlation_id`
- `access_mode`
- `country_code`
- `region_code`
- `match_strategy`

---

## 关联模块（约束落点）

- **强约束**：`RD-行政区域边界与选区交互.md`（从名称到 region_code 的升级）
- **强约束**：`RD-GPS定位与反向地理编码.md`（坐标→行政区闭环）
- **建议联动**：`RD-共享类型与接口契约.md`（region_code/region_scope/region_timezone 字段固化）

---

## 验收标准（Go/No-Go）

- **编码契约**：
  - 任意区域选择入口最终都能稳定产出 `region_code`（而不是仅名称）。
- **可解释映射**：
  - 每次映射都有 `match_strategy`，并可追溯 `region_dataset_version`。
- **性能**：
  - 搜索与区域数据加载满足初始门槛（p95 目标），且按国家分片不引入明显卡顿。

---

## 反例（必须禁止）

- **反例 1**：用 `province/district` 自由文本作为状态主键或缓存 key。
- **反例 2**：mapping 表更新后无版本失效策略，导致同一名称在不同客户端解析到不同 region。
- **反例 3**：GPS 解析直接信任 Geocoding 返回文本，不做“系统支持集合”校验，导致解析到系统不存在的区域。

---

## 未决问题（Open Questions）

- Q1：region_code 的权威编码体系最终采用什么（GADM code / 自研 code / mapping table）？必须与边界数据源可对齐。
- Q2：region_timezone 的来源：基于 country 默认、基于 region 表、还是基于外部数据集？需要在 Shared Contract 固化。
