# 17 - Google Maps API 配置与初始化（Key/加载/合规 Gate）- v2 实施细则

> 对应 `docs/v2/v2实现步骤总览.md` Step 17  
> 状态：Draft（可开工）  
> 版本：v2.0  
> 创建日期：2026-01-16  
> 最后更新：2026-01-16

---

## 模块名称

Google Maps JavaScript API 配置与初始化（Next.js App Router：环境变量注入、动态加载、Key 限制、合规 Gate）

---

## 目标 / 非目标

### 目标

- 建立 v2 前端对 Google Maps JavaScript API 的**唯一加载入口**与配置基线：
  - **动态加载**（Dynamic Library Import / `@googlemaps/js-api-loader` v2）
  - 统一 `version`、`language`、`region`、`mapIds`、`authReferrerPolicy`
  - 只加载必要 libraries（maps/marker/data/geometry…）
- 建立**合规 Gate（上线门槛）**：
  - Key 安全（HTTP referrer + API 限制）
  - Attribution 不得移除/遮挡
  - 遵守缓存/存储限制（不得预取/缓存受限内容）
  - 成本/配额监控可用
- 与 v2 红线对齐：
  - 只加载一次；后续模块不得重复加载或改写全局参数
  - hover 0 重请求（由后续 Map Stage / Orchestration 承接）

### 非目标

- 不在本细则实现地图 UI、图层渲染、边界交互（见 Step 18/19）。
- 不在本细则实现 Places/Geocoding/Time Zone 等 Web Service 调用（若需要，必须走后端代理与独立 key 策略）。

---

## 关联的数据产品（Data Product）

地图初始化本身不直接产出数据产品，但它是所有地图渲染（Overlays）与交互链路的基础设施，会影响：

- Map Overlays（地图叠加层）
- L0/L1 面板联动（通过地图交互触发）

---

## 输入维度（最小集合）

> 该模块的“输入”主要是配置参数与环境变量，不承载业务维度。

- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`（客户端公开变量；会被打包进浏览器 bundle）
- `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`（可选：Map ID / Cloud-based map styling）
- `region` / `language`（首次加载后不可变）

---

## 输出形态

- 一个**可复用且只初始化一次**的 Maps JS API 加载器（供 Map Stage 使用）
- 一个**可审计的**“Maps 配置对象”（版本/参数/库）与合规校验清单

---

## Mode 规则（必须写）

Maps 初始化参数不随 `access_mode` 变化（避免重复加载与不确定性），但合规与成本策略必须覆盖 Demo/Public 公开访问场景：

- Demo/Public 环境必须严格启用 Key 限制与预算告警（防止公开页面被盗刷）。

---

## predicted 规则（必须写）

Maps 初始化不直接涉及 predicted；但**不得**把 prediction_run_id 等业务状态塞进 Maps “加载参数”（会导致重复加载/不可控）。

---

## 性能与缓存策略

### 加载方式（强制）

必须采用**动态加载**（官方提供 Dynamic Library Import 与 NPM `@googlemaps/js-api-loader` 方案）：

- 参考（Dynamic library import / js-api-loader）：`https://developers.google.com/maps/documentation/javascript/load-maps-js-api?utm_source=gmp-code-assist`

约束：

- Maps JS API **只能加载一次**；且 `language/region` 等参数首次加载后不可变（官方库与生态（如 `@vis.gl/react-google-maps`）明确强调此限制）。
- libraries 应按需加载（避免一次性引入全部包），常用：
  - `maps`（Map）
  - `marker`（AdvancedMarkerElement）
  - `data`（Data Layer / GeoJSON）
  - `geometry`（spherical.*：用于插值/距离/heading 的基础能力）

### 缓存/存储限制（合规门槛）

必须遵守 Google Maps Platform 的政策与服务条款：不得预取、索引、存储或缓存受限 Content（除条款明确允许的例外），并在实现上尊重响应中的缓存头（如 `Cache-Control`/`ETag`）。

- Maps JS API policies：`https://developers.google.com/maps/documentation/javascript/policies?utm_source=gmp-code-assist`
- Map Tiles API policies（关于缓存/预取/存储的具体约束表述）：`https://developers.google.com/maps/documentation/tile/policies?utm_source=gmp-code-assist`

---

## 可观测性

必须打点（至少）：

- `maps_api_load_start`
- `maps_api_load_success` / `maps_api_load_error`
- 记录配置快照（用于排障与合规审计）：
  - `version`
  - `libraries_preloaded`
  - `language/region`
  - `authReferrerPolicy`
  - `mapIds`（是否设置）

---

## 合规 Gate（必须在上线前完成）

### 1) API Key 安全（必须）

遵循 Google API Security Best Practices（官方最佳实践）：

- `https://developers.google.com/maps/api-security-best-practices?utm_source=gmp-code-assist`

强制要求：

- **HTTP referrer 限制**：只允许指定域名（Demo/Prod 分开）
- **API restrictions**：只授权实际使用的 APIs（至少包含 Maps JavaScript API；如使用 Geocoding Service/Places 等，再按需授权）
- **拆分 Key**（建议）：客户端 Maps JS API key 与服务端 Web Service key 分离，避免“一个 key 打天下”

> 注意（Next.js）：`NEXT_PUBLIC_*` 会被内联进客户端 bundle（Context7 / Next.js 文档明确），因此应将其视为“公开但受限”的 key：只能通过 referrer + API 限制来控制风险。

### 2) Attribution（必须）

- Maps JS API policies（Attribution）：`https://developers.google.com/maps/documentation/javascript/policies?utm_source=gmp-code-assist`

硬规则：

- 不得移除/遮挡/弱化 Google Maps attribution
- 如在非 Google Map 容器展示 Google Maps 内容，必须清晰标注并区分自有内容与 Google 内容

### 3) 预算与监控（必须）

- 必须配置预算告警/用量监控（避免盗刷与路演公开页面的不可控成本）

---

## 复用声明（必须写清楚）

### Reuse Digest（必填引用）

- `docs/v2/v2复用逻辑摘录/RD-地图主舞台.md`（动态加载/生命周期约束）
- `docs/v2/v2复用逻辑摘录/RD-地图模式与动画系统.md`（vector/webgl 能力边界与文档链接）

### 来自 v1 的可复用资产（R0/R1）

- 复用“动态加载 + 避免重复加载”的思想，但 v2 必须与 Key 限制、attribution、缓存政策绑定为上线门槛。

### 不复用内容（R3）

- 不复用“直接静态 script 粗暴加载 + 任意页面重复加载”的模式。

---

## 验收用例（可勾选）

### 功能（必须）

- [ ] Maps JS API 可在 Next.js Client Component 中稳定加载（只加载一次），并可被后续模块安全复用。

### 安全/合规（必须）

- [ ] Key 已配置 HTTP referrer 限制 + API restrictions（且 Demo/Prod 分离）。
- [ ] Attribution 在 UI 中清晰可见，且未被遮挡。
- [ ] 已明确禁止缓存/存储受限内容（并在实现中避免相关行为）。

---

## 两个“最常见失败模式”（必须写进每个模块）

### 失败模式 A：前端隐藏当权限

症状：把 Key 当“机密”硬塞进前端，误以为不暴露。  
硬规则：`NEXT_PUBLIC_*` 一定会进 bundle；必须靠 referrer + API 限制、预算告警、分 key 策略来降低风险。

### 失败模式 B：predicted 混批次

症状：把业务维度（prediction_run_id）塞进 Maps 加载参数，导致重复加载或状态撕裂。  
硬规则：Maps 加载只做一次；prediction_run_id 只存在于数据产品请求与 UI 状态域。

---

## 风险与回滚策略

### 风险

- Key 未限制：公开 Demo 被盗刷导致成本与不可用（P0）。
- 重复加载：language/region 变更无效或报错，导致线上不可控（P0/P1）。

### 回滚策略

- 发现盗刷：立即收紧 referrer / API restrictions，必要时轮换 key，并下线公开入口。
- 发现重复加载：强制收敛为单入口加载器，禁止任意组件自行加载。

