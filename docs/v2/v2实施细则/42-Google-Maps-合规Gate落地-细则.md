# 42 - Google Maps 合规 Gate 落地（Key/Attribution/CSP/缓存/预算/限流）- v2 实施细则

> 对应 `docs/v2/v2实现步骤总览.md` Step 42  
> 状态：Draft（可开工）  
> 版本：v2.0  
> 创建日期：2026-01-19  
> 最后更新：2026-01-19

---

## 模块名称

Google Maps 合规 Gate：把“Maps 能不能上、怎么安全上、怎么不被盗刷、怎么不踩条款”固化为上线门槛（Go/No-Go）与运行时/CI 的 guardrails

---

## 目标 / 非目标

### 目标

- 把 Google Maps Platform 的关键合规项固化为 **可执行 Gate**：
  - API Key 安全（网站 referrer + API restrictions + 分 Key/分 Project/分用途）
  - Attribution 要求（不得移除/遮挡/弱化）
  - CSP（严格 CSP / allowlist CSP，且必须包含 googleapis.com）
  - 缓存/存储限制（禁止预取/索引/长期存储受限内容；尊重缓存头）
  - 成本与用量治理（预算告警、配额监控、异常用量处置）
  - Web Service 调用治理（必须走后端代理；限流与指数退避）
- 与 v2 三条红线对齐：
  - **权限旁路**：Demo/Public 公开入口下必须更严格（盗刷/滥用风险最高）
  - **交互风暴**：地图交互不触发 Web Service 风暴；高频交互节流（与 Step 20/24 对齐）
- 为 Step 17/18/29 等已落地模块提供“上线门槛化”的统一标准（避免各模块各说各话）

### 非目标

- 不在本细则实现具体地图渲染（Step 18/19/22/23/34）。
- 不在本细则实现具体 Web Service 业务逻辑（如反向地理编码闭环见 Step 29），这里只定义“合规与治理门槛”。

---

## 关联的数据产品（Data Product）

合规 Gate 本身不产出数据产品，但对以下模块是硬依赖门槛：

- Map Stage / Overlays（Step 17/18/12）
- GPS 定位与反向地理编码（Step 29：Web Service 必须走后端代理）
- AI（Step 37/41：不得在 AI 中泄露 key/敏感配置）

---

## 输入维度（最小集合）

> 该模块主要输入为“环境配置/发布配置”，不承载业务维度。

### 配置输入（建议）

- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`（浏览器端，仅用于 Maps JavaScript API；视为“公开但受限”）
- `GOOGLE_MAPS_WEB_SERVICE_API_KEY`（服务端 Web Service key，仅在后端，禁止进入前端 bundle）
- `ALLOWED_MAPS_REFERRERS`（允许的域名/子域；Demo/Prod 分离）
- `MAPS_ALLOWED_APIS`（API restrictions 清单）
- `CSP_MODE`：`strict-nonce` | `allowlist`
- `MAPS_BUDGET_ALERTS_CONFIGURED`（发布检查项；可人工/CI 证明）

---

## 输出形态

### 1) Gate 结果（建议）

- `gate_status`：`pass` | `warn` | `fail`
- `failed_checks[]`：失败项列表（必须）
- `warnings[]`：风险提示（建议）
- `runtime_degrade_plan`：若 fail/warn，哪些功能降级/禁用

### 2) 运行时降级（必须）

当 Gate fail（或关键项 warn）时：

- 禁用高成本/高风险能力：
  - 前端：禁止调用任何 Maps Web Service（本来就不允许；fail 时进一步硬禁）
  - 反向地理编码：禁用或只走内部 region mapping（不触达 Google）
- Map 加载失败时提供明确 UI：
  - 解释原因（配置缺失/授权失败/配额超限）
  - 提供“继续演示”的替代路径（Mock/静态占位/仅面板可用）

---

## Mode 规则（必须写）

### Demo/Public（强制更严格）

- 公开访问风险最高，必须：
  - 浏览器 key 必须网站 referrer 限制 + API restrictions（只开 Maps JavaScript API 等必要项）
  - 必须配置预算告警与用量监控（异常用量可快速止血）
  - Web Service 必须走后端代理 + 限流（防盗刷/防风暴）

### Partner/Admin

- 仍需 Key 限制与预算治理；差异在于可开放更高 QPS 与更深功能（前提：监控与限流齐备）。

---

## predicted 规则（必须写）

合规 Gate 不直接涉及 predicted；但必须禁止把业务维度塞进 Maps 加载参数（避免重复加载/状态撕裂）：

- `prediction_run_id` 只能存在于数据产品请求与 UI 状态域（见 Step 17/18/03）。

---

## 合规 Gate 细则（可执行清单）

> 本节每条都需要可验证（CI 检查 / 发布清单 / 运行时自检），避免“写在文档里但没人做”。

### 1) API Key 安全（必须）

官方依据：

- API Security Best Practices：`https://developers.google.com/maps/api-security-best-practices?utm_source=gmp-code-assist`

强制要求：

- **分 Key**：
  - Browser key：仅用于 Maps JavaScript API（Website restrictions + API restrictions）
  - Server key：仅用于 Web Service（IP restrictions + API restrictions；禁止进入前端）
- **分用途/分环境**：
  - Demo/Prod key 分离（避免公开路演 key 影响生产）
  - 如同一 key 出现多个 platform_type（JS + Webservice），按官方建议迁移为多个 key
- **API restrictions**：
  - 仅授权实际使用 API；Maps JS 必须授权 Maps JavaScript API（官方强调）
  - 若使用 Maps JS 内置 Geocoding Service 等，对应也需授权 Geocoding API（官方表格列出映射关系）
- **严禁在前端暴露 Web Service key**：
  - 官方明确：Web service keys 预期不公开；应作为服务器与 Google 的共享秘密

Gate 落地建议：

- CI 检查：禁止出现 `GOOGLE_MAPS_WEB_SERVICE_API_KEY` / 任何 server key 前缀出现在 `NEXT_PUBLIC_*`
- 运行时自检：前端启动时打印 `maps_key_scope=browser_only` 的审计日志（不含 key 值）

### 2) Secure client-side web service calls（必须）

官方依据：

- API Security Best Practices（secure client-side web service calls / proxy server 提示）：`https://developers.google.com/maps/api-security-best-practices?utm_source=gmp-code-assist`

硬规则：

- 浏览器端不得直接调用 Geocoding/Places/Routes 等 Web Service；
- 必须走后端代理（FastAPI），并由后端持有 server key + IP restrictions + 限流/退避。

### 3) CSP（必须）

官方依据：

- Maps JavaScript API CSP：`https://developers.google.com/maps/documentation/javascript/content-security-policy?utm_source=gmp-code-assist`

硬规则：

- CSP 必须包含 `googleapis.com`，否则 Maps JS API 会拒绝请求（官方说明）
- 推荐 strict CSP（nonce + strict-dynamic），并为 Maps 插入的 script/style 提供 nonce（官方说明）

Gate 落地建议：

- 发布清单：提供 CSP header 样例（strict-nonce 或 allowlist）与验证方式（浏览器控制台无 CSP violation）
- 运行时监控：捕获 CSP 违规日志并聚合（出现即告警）

### 4) Attribution（必须）

官方依据：

- Maps JavaScript API policies：`https://developers.google.com/maps/documentation/javascript/policies?utm_source=gmp-code-assist`

硬规则：

- 不得移除/遮挡/弱化 Google Maps attribution；
- 若与第三方/自有内容混排，必须明确区分何为 Google Maps Content（避免混淆来源）。

Gate 落地建议：

- E2E（或人工）验收项：截图确认 attribution 清晰可见（且不会被固定 UI 覆盖）

### 5) 缓存/存储限制（必须）

官方依据（政策与条款入口）：

- Maps JavaScript API policies：`https://developers.google.com/maps/documentation/javascript/policies?utm_source=gmp-code-assist`
- Map Tiles API policies（关于缓存/预取/存储限制的政策入口）：`https://developers.google.com/maps/documentation/tile/policies?utm_source=gmp-code-assist`

硬规则（v2 采取保守策略，默认不落地任何“长期缓存 Google 内容”）：

- 禁止对 Google Maps Content 做预取/索引/长期存储（包括 tiles、place details、地址文本等）
- 如某 Web Service 响应允许缓存，也必须遵守响应缓存头（`Cache-Control`/`ETag`），且避免把原始响应持久化到业务数据库
- 允许存储的仅为 **自有派生事实**（示例）：
  - `region_code/region_scope`（内部行政区映射结果）
  - 统计聚合指标（不包含 Google 原始内容）

Gate 落地建议：

- 代码审计规则：禁止把 Google Web Service 原始响应体写入 DB（只允许写入派生 `region_code` 等）
- 日志审计规则：日志不得记录完整地址/完整 place details（仅记录 hash 或截断 + 明确脱敏）

### 6) 预算、用量与异常处置（必须）

官方依据（监控/用量入口在安全最佳实践与 FAQ 中有指引）：

- API Security Best Practices（Check your API key usage / Monitor）：`https://developers.google.com/maps/api-security-best-practices?utm_source=gmp-code-assist`
- Maps FAQ（usage limits & billing / quota monitoring）：`https://developers.google.com/maps/faq?utm_source=gmp-code-assist`

硬规则：

- 必须配置预算告警（Budget alerts）与用量监控（maps request_count 等指标）
- 必须有“盗刷/异常用量”止血预案：
  - 立即收紧 referrer / API restrictions
  - 必要时轮换 key
  - 临时关闭公开入口（Demo）

Gate 落地建议：

- 发布门槛：`MAPS_BUDGET_ALERTS_CONFIGURED=true`（来自人工检查或 IaC 输出证明）
- 观测事件：`maps_quota_warning`、`maps_over_limit`、`maps_key_unauthorized`

### 7) Web Service 限流与指数退避（必须）

官方依据（Web Service client library 行为说明）：

- Geocoding client library（提到 automatic rate limiting + exponential backoff on 5xx）：`https://developers.google.com/maps/documentation/geocoding/client-library?utm_source=gmp-code-assist`

硬规则：

- Web Service 仅后端调用，并必须实现：
  - per-user / per-ip / per-session 限流（token bucket，建议 Redis）
  - 5xx 自动重试 + 指数退避（带抖动）
  - 4xx（如未授权/配额）不盲目重试，直接降级并告警
- 与 v2 交互红线对齐：
  - hover 不触发 Web Service
  - 仅在“明确意图”（GPS 定位按钮、用户提交表单）触发

### 8) Terms / EEA（必须）

官方依据（Terms 入口）：

- Google Maps Platform Terms of Service：`https://cloud.google.com/maps-platform/terms`
- EEA Service Specific Terms（如适用）：`https://cloud.google.com/terms/maps-platform/eea`

硬规则：

- 必须遵守 Google Maps Platform Terms（包括但不限于 Attribution、缓存/存储限制、禁止抓取与滥用等）。
- 若计费地址在 EEA：上线前必须做 EEA 条款适配检查（合规 Gate 中单独标记为 `EEA_REVIEW_REQUIRED`）。

---

## 可观测性

必须记录（至少）：

- `maps_api_load_start/success/error`（Step 17 已定义）
- `maps_webservice_proxy_request`（geocoding 等）
- `maps_webservice_proxy_rate_limited`
- `maps_webservice_proxy_retry`（含 backoff_ms、attempt）
- `maps_policy_gate_fail`（failed_checks）

必带字段：

- `trace_id/correlation_id`
- `access_mode`
- `origin`（feature：map_load/gps_reverse_geocode/places_search…）
- `http_status`、`api_name`
- `latency_ms`

---

## 复用声明（必须写清楚）

### Reuse Digest（必填引用）

- `docs/v2/v2复用逻辑摘录/RD-地图主舞台.md`
- `docs/v2/v2复用逻辑摘录/RD-GPS定位与反向地理编码.md`
- `docs/v2/v2复用逻辑摘录/RD-性能优化.md`
- `docs/v2/v2复用逻辑摘录/RD-分层职责与协作边界.md`

### 来自 v1 的可复用资产（R1）

- 复用“前端 Map 主舞台 + Web Component/Kit 集成”的方向；
- 但 v2 必须把合规与成本治理提升为上线 Gate（v1 常见遗漏点）。

### 不复用内容（R3）

- 不复用“前端直接调用 Web Service”与“未限制 key 的公开 Demo”模式（高风险）。

---

## 验收用例（可勾选）

### 安全（必须）

- [ ] Browser key 已配置 Website restrictions + API restrictions（至少 Maps JavaScript API），且 Demo/Prod 分离。
- [ ] Server key 仅存在于后端（不进入前端 bundle），并配置 IP restrictions + API restrictions。
- [ ] 任何 Geocoding/Places/Routes 等 Web Service 调用都走后端代理（前端无直连）。

### CSP（必须）

- [ ] CSP 已启用且包含 `googleapis.com`；浏览器控制台无 Maps 相关 CSP 违规。

### Attribution（必须）

- [ ] attribution 清晰可见且未被覆盖（截图验收）。

### 缓存/存储（必须）

- [ ] 未持久化存储 Google Web Service 原始响应（仅存派生 `region_code` 等自有事实）。

### 成本与限流（必须）

- [ ] 已配置预算告警；异常用量可止血（收紧限制/轮换 key/关闭 Demo）。
- [ ] Web Service 代理具备限流 + 退避 + 可观测事件。

---

## 两个“最常见失败模式”（必须写进每个模块）

### 失败模式 A：前端隐藏当权限

症状：以为 `NEXT_PUBLIC_*` 里放 key 就“不会泄露”；或 Demo 入口公开但未限制 key。  
硬规则：`NEXT_PUBLIC_*` 必进 bundle；必须靠 referrer + API restrictions、分 key、预算告警止损。

### 失败模式 B：predicted 混批次

症状：把业务维度（prediction_run_id）塞进 Maps 加载参数导致重复加载与状态撕裂。  
硬规则：Maps 只初始化一次；prediction_run_id 只在数据产品请求与 UI 状态域流转。

---

## 风险与回滚策略

### 风险

- 公共 Demo 被盗刷导致成本爆炸与服务不可用（P0）。
- CSP 配置不完整导致地图不可用（P0/P1）。

### 回滚策略

- 发现盗刷：立刻收紧 referrer/API restrictions，必要时轮换 key，短期下线 Demo 入口。
- CSP 失败：切换到 allowlist CSP（短期止血），随后回到 strict-nonce CSP 并补齐域名白名单。
- Web Service 风暴：暂时关闭相关入口（GPS/搜索），仅保留内部 region 映射与静态交互。

