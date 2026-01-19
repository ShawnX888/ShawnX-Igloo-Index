# 29 - GPS 定位与反向地理编码（坐标→行政区→region_code）- v2 实施细则

> 对应 `docs/v2/v2实现步骤总览.md` Step 29  
> 状态：Draft（可开工）  
> 版本：v2.0  
> 创建日期：2026-01-16  
> 最后更新：2026-01-16

---

## 模块名称

GPS 定位与反向地理编码（Browser Geolocation + Reverse Geocoding + 行政区解析/映射 → region_code）

---

## 目标 / 非目标

### 目标

- 落地 v2 的定位闭环（与 `v2迁移分层矩阵.md`、`RD-GPS定位与反向地理编码.md` 一致）：
  - 获取用户坐标（lat/lng）
  - 反向地理编码获取行政层级（country / admin_level_1 / admin_level_2/locality…）
  - 与 region 数据集（centers + mapping + hierarchy）做双重验证并映射到 `region_code`
  - 驱动 Map lock + 刷新 L0/L1/Overlays（通过 UI Orchestration 的单一事实源）
- 以“合规 + 成本 + 体验可控”为上线门槛：
  - Geocoding/Time Zone 等 web service 调用必须有节流/限流/失败降级
  - 严格遵守 key 安全策略（web service key 不得用浏览器 referrer key）
  - 反向地理编码结果不得长期存储（按政策/条款约束与 TTL）
- 可观测：定位全链路可追踪，且映射命中策略可审计（semantic/nearest）。

### 非目标

- 不在本细则实现 GPS → 行政区的“点-in-polygon”精确落区（可作为后续增强；MVP 先用 centers + 语义双验证）。
- 不在本细则实现“全球任意区域”覆盖（以可配置国家集为准）。

---

## 关联的数据产品（Data Product）

定位成功后将触发（由 Orchestration 统一调度）：

- L0 Dashboard（Step 11）
- Map Overlays（Step 12）
- L1 Region Intelligence（Step 13）

---

## 输入维度（最小集合）

定位链路的输入：

- `lat` / `lng`（来自浏览器定位；日志需脱敏/降精度策略）
- `access_mode`
- `country_code`（可由 geocoding 结果推断）
- `region_dataset_version`（用于可追溯与缓存失效）

下游刷新需要的 Shared Contract 维度（由 Orchestration 写入）：

- `region_scope` / `region_code`
- `time_range`
- `data_type` / `weather_type` / `product_id`
- predicted：`prediction_run_id`

---

## 输出形态

### 定位解析输出（必须）

- `region_code`
- `region_scope`
- `display_name`（仅 UI）
- `match_strategy`：`semantic` | `nearest` | `mapping` | `exact`
- `candidates`（可选：仅日志摘要；不得长期存储完整 geocoding 内容）
- （可选）`place_id`（可用于短期缓存与追溯；place_id 通常允许长期存储的例外需按政策确认）

### UI 行为输出（必须）

- `map_lock(region_code)`
- `dp_refresh_commit`（触发 L0/L1/Overlays 刷新）

---

## Mode 规则（必须写）

- Demo/Public：
  - 功能可用，但必须严格控制成本（节流/限流）与隐私（日志降精度）
  - 若被禁用（例如合规 gate 未过），必须提供降级 UX：提示 + 手动选区
- Partner/Admin：
  - 允许更高频（仍需限流），更细粒度定位反馈（但不暴露敏感地址信息）

硬规则：
- Mode 不得仅靠前端开关；若后端禁用/裁剪，需要一致响应与审计。

---

## predicted 规则（必须写）

定位本身不区分 predicted，但定位触发的数据产品刷新必须遵守：

- `data_type=predicted` 时，必须使用页面锁定的 `prediction_run_id`（不得触发“切批次”副作用）
- 禁止定位链路引入 prediction_run 的权威选择逻辑（批次由 Prediction Run Service 决定）

---

## 合规与安全（强制）

### Key 与调用形态（强制）

依据 Google API 安全最佳实践：**web service APIs（Geocoding/Time Zone 等）不应使用浏览器 referrer key 直接调用**；推荐使用 server-side key（IP restrictions）或通过安全代理。

- API Security Best Practices：`https://developers.google.com/maps/api-security-best-practices?utm_source=gmp-code-assist`

落地约束：

- **浏览器端**：只使用 W3C Geolocation（浏览器原生定位），不调用 Geolocation Web Service（Geolocation API 是 WiFi/基站定位的 web service）
- **后端**（推荐）：提供 `geo` 代理端点调用：
  - Geocoding API（reverse geocoding）：`https://developers.google.com/maps/documentation/geocoding/overview?utm_source=gmp-code-assist`
  - Time Zone API（若用于推导 `region_timezone`）：`https://developers.google.com/maps/documentation/timezone/overview?utm_source=gmp-code-assist`

### 缓存/存储限制（强制）

- Geocoding API policies：`https://developers.google.com/maps/documentation/geocoding/policies?utm_source=gmp-code-assist`

最低要求：

- 不长期存储 Geocoding 返回的完整地址组件/格式化地址
- 如做缓存：必须有 TTL、可审计、可按 region_dataset_version 失效
- 系统长期持久化的应是：`region_code`（内部主键）与必要的映射版本信息

---

## 性能与限流策略

### 前端节流（强制）

- GPS 按钮点击必须防抖（避免 burst）
- 失败重试需指数退避（或至少间隔退避），并对用户提示“稍后再试”

### 后端限流（强制，若使用后端代理）

- 按 `user/session/ip` 做限流（保护配额与成本）
- 对外部 API 调用做超时、重试（指数退避），并记录错误类型

### 经验门槛（可调整，但必须量化）

- 定位（含 reverse geocode）p95 < 3s（RD 建议初始目标）

---

## 行政区解析与映射（v2 强制）

### 双重验证（必须）

严格执行 `RD-GPS定位与反向地理编码.md`：

1) centers 就近候选（取 top 3–5）  
2) 语义匹配（geocoding 名称 ↔ mapping/aliases）  
3) 兜底：就近（match_strategy=nearest）  
4) 输出必须落在系统支持集合（hierarchy）

### 禁止行为（必须）

- 禁止使用自由文本（province/district 名称）作为状态主键或缓存 key（必须落到 region_code）

---

## 可观测性

必须记录链路：

- `gps_click` → `geolocation_result` → `reverse_geocode_call` → `candidate_selection` → `semantic_match_result` → `region_selected` → `map_lock` → `dp_refresh`

必带字段（至少）：

- `trace_id/correlation_id`
- `access_mode`
- `lat/lng`（建议降精度或 hash）
- `region_code/region_scope`
- `match_strategy`
- `region_dataset_version`

---

## 复用声明（必须写清楚）

### Reuse Digest（必填引用）

- `docs/v2/v2复用逻辑摘录/RD-GPS定位与反向地理编码.md`
- `docs/v2/v2复用逻辑摘录/RD-行政区域数据管理与名称映射.md`
- `docs/v2/v2复用逻辑摘录/RD-共享类型与接口契约.md`
- `docs/v2/v2复用逻辑摘录/RD-性能优化.md`

---

## 验收用例（可勾选）

### 功能闭环（必须）

- [ ] 点击 GPS → 获取坐标 → 反向地理编码 → 输出 region_code → map lock → 刷新 L0/L1/Overlays。

### 降级与稳定性（必须）

- [ ] 拒绝授权/超时/不可用时：提示错误 + 保持当前选区 + 支持重试/手动选择。
- [ ] 连续点击不会产生 Geocoding 请求风暴（前端防抖 + 后端限流）。

### 合规（必须）

- [ ] 不长期存储 geocoding 原始结果；若缓存有 TTL 与审计；key 安全策略符合最佳实践。

---

## 两个“最常见失败模式”（必须写进每个模块）

### 失败模式 A：前端隐藏当权限

症状：Demo/Public 通过抓包能直接调用 Geocoding web service，或暴露 key，导致盗刷/泄露。  
硬规则：web service 调用必须走后端代理与 IP 限制 key；预算告警必须开启。

### 失败模式 B：predicted 混批次

症状：定位触发刷新时混用了不同 prediction_run，导致地图/面板解释断裂。  
硬规则：prediction_run_id 顶层锁定；定位只改变 region，不改变批次；所有 dp 请求携带同 run_id。

---

## 风险与回滚策略

### 风险

- geocoding 依赖外部服务：超时/限流会导致体验不稳定（P0/P1）
- 名称映射漂移：同一坐标不同时间映射到不同 region（P0）

### 回滚策略

- 降级为“仅 GPS 点定位 + 用户手动选区”或“仅就近候选列表”模式，保持演示可用
- 映射数据集版本化并可回滚（region_dataset_version），对错映射可热修复

