# Reuse Digest — 页面间联动（首页 ↔ 产品介绍页）

> 状态：Draft  
> Reuse Type：R1（复用但重构）  
> Target Home：FE + Shared Contract  
> 绑定验收锚点：L0/L1/L2（用户旅程闭环）、Perf/SLO（避免重复初始化/风暴）、Observability

---

## 1. v1 输入材料（仅作线索，禁止当真源）

- `docs/v1/21-页面间联动.md`

---

## 2. 可复用逻辑与要求（完整重述）

### 2.1 从首页到产品页（Product Intro）
- 从产品选择器的 “More” 进入产品介绍页（不带参数也可）。
- 支持跳转到产品页指定章节（例如 core-products），通过 `scrollToSection` 类机制实现。
- 页面切换应自动滚动到顶部（除非指定章节）。

### 2.2 从产品页到首页（Simulate risk）
- 产品页提供多个 “Simulate risk” 按钮，每个按钮对应一个产品。
- 点击后跳转回首页，并 **自动设置选中产品**。
- v1 的重要约束：区域、data_type、time_range 使用默认值，不随产品自动改写（避免隐藏副作用）。

### 2.3 状态传递机制
- v1 通过页面级状态把 `initialProduct` 传给 Dashboard，用于初始化 selectedProduct（避免 useEffect 再次改写）。
- 需要有“状态同步正确、不丢数据”的保证。

---

## 3. v2 化适配（必须写清楚）

### 3.1 从“页面切换”升级为“路由 + 可复现的视图状态”
v2 是整全集：页面之间的联动不只是 UI 跳转，而是进入“可复现的视图状态”：
- 首页视图状态至少包含：region、time_range、data_type、weather_type、product_id、access_mode、prediction_run_id（predicted）
- v2 推荐用 **URL 查询参数/可序列化 state** 表达“Simulate risk 的默认剧本”，确保：
  - 可分享/可回放
  - 可观测（埋点能还原当时口径）

### 3.2 默认值策略（必须显式）
保留 v1 的“避免隐式副作用”思想，但 v2 必须把默认策略写成契约：
- Simulate risk 跳回首页时：
  - product_id：设置为指定产品
  - 其他维度：使用 v2 的默认值（但必须在 `v2项目总览/步骤总览` 中写明默认值来源）
  - access_mode：以当前 mode 为准（不允许被跳转偷偷改变）
  - predicted：若在 predicted 页面触发跳转，必须保持 prediction_run 一致或显式切换（不可混批次）

### 3.3 与数据产品/缓存的协作
- 跳转到首页并设置 product_id 会触发 Overlays/L1 的数据刷新，但必须：
  - 避免“初始化时清缓存”这类开发期逻辑影响 v2 正常体验
  - 缓存 key 维度规则以 `RD-性能优化.md` 为准（至少包含 `access_mode`；predicted 额外包含 `prediction_run_id`）

### 3.4 可观测性
至少记录：
- simulate_risk_click（product_id、from_page）
- route_change（to=home/product）
- state_initialized（哪些维度被设置/保持）
- dp_requests（哪些数据产品被触发）
- 必带字段：遵循 Shared Contract 的可观测字段约定（见 `RD-共享类型与接口契约.md` 的“可观测性字段约定”），predicted 场景必须包含 `prediction_run_id`。

---

## 4. 验收用例（必须）与反例（禁止）

### 4.1 验收用例（Acceptance）
- [ ] 从产品页点击 Simulate risk 能进入首页，并正确设置 product_id，触发对应地图/面板刷新。
- [ ] 跳转后不会“隐式改写”region/time_range/data_type（除非 v2 默认策略明确规定），且行为可解释。
- [ ] 从首页进入产品页支持跳到指定章节；不指定章节时滚动到顶部。
- [ ] 跳转链路可追踪（埋点可还原触发源、目标、关键维度）。

### 4.2 反例（Non-examples / Forbidden）
- [ ] 禁止：Simulate risk 跳转时偷偷修改 access_mode 或混用 prediction_run（解释断裂）。
- [ ] 禁止：页面切换时全局清缓存导致数据口径抖动或体验不稳定。

---

## 5. 未决问题（Open Questions）
- Q1：v2 的“默认剧本参数”（默认 region/time_range/weather_type/data_type）是否固定为路演口径，还是按用户上次选择持久化？

