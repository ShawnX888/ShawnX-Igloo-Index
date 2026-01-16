# Reuse Digest — 性能优化（缓存/渲染/计算/动画）

> 状态：Draft  
> Reuse Type：R1（复用但重构）  
> Target Home：FE + BE + Infra/Governance  
> 绑定验收锚点：Perf/SLO、Prediction Run、Observability、Reliability

---

## 1. v1 输入材料（仅作线索，禁止当真源）

- `docs/v1/22-性能优化.md`

---

## 2. 可复用逻辑与要求（完整重述）

### 2.1 数据缓存（减少重复计算/重复生成）
- v1 强调：缓存 key 必须包含所有会改变结果的维度，避免“命中即错口径”。
- 通过 memoization（v1 用 useMemo）缓存计算结果，并在参数变化时更新。
- 支持增量更新：只计算新增窗口、只更新变更区域。

### 2.2 地图渲染优化
- 通过“图层可见性控制”避免渲染不可见图层。
- 大量 polygon/marker 更新要增量化。
- 必要时数据采样减少渲染量。

### 2.3 计算优化
- 只计算新增时间窗口（增量计算）。
- 数据量大时考虑并行/隔离（v1 提到 Web Worker 的方向）。
- 优化产品规则解析性能。

### 2.4 动画与组件渲染优化
- 动画只用 transform/opacity，配合 will-change，限制同时动画数量。
- 组件渲染：React.memo、useCallback，避免无意义重渲染。

### 2.5 性能验收指标（v1 给出）
- 参数修改后风险计算 + 视图更新：1s 内
- Mock 数据生成/补充：2s 内
- 地图切图层无明显卡顿
- 页面加载：3s 内
- 图表渲染：1s 内
- Web 指标：FCP/LCP/FID/CLS 目标

---

## 3. v2 化适配（必须写清楚）

### 3.1 从“前端缓存”升级为“数据产品缓存 + 前端请求治理”
v2 的性能核心不再是前端 useMemo：
- **后端**：以 Data Product 为单位做缓存/预聚合（Redis、物化视图/分区等），并把缓存 key 维度写死：
  - 至少包含 access_mode
  - predicted 额外包含 prediction_run_id（或 active_run 标识）
- **前端**：TanStack Query 统一管理 server-state；把节流/去抖规则固化到 UI Orchestration 层。

### 3.2 Hover/Brush/Toggle 的性能红线（强制）
- Hover：0 次 L1/L2 明细重请求
- Brush：高频交互必须节流（避免每像素一次请求）
- Toggle：默认只改呈现；若触发 Overlays 刷新必须节流

### 3.3 计算隔离（可靠性）
v2 的重计算必须从前端/路由线程移出：
- 计算逻辑在 BE compute/tasks 层执行（Celery/线程池），避免阻塞 API event loop。
- 幂等：任务重试不产生重复写入（risk_events/claims）。

### 3.4 动画降级与主舞台优先
- 风险标记动画数量必须有上限；低性能设备/移动端降级。
- prefers-reduced-motion 必须尊重。
- 地图主舞台优先：面板展开不许拖慢地图交互。

### 3.5 可观测性（必须）
把“性能优化”变成可证明：
- 埋点/日志：dp_cache_hit、dp_latency、ui_render_done、map_fps_drop（可选）
- 必带字段：trace_id/correlation_id + access_mode + data_type + weather_type + product_id + prediction_run_id（predicted）

---

## 4. 验收用例（必须）与反例（禁止）

### 4.1 验收用例（Acceptance）
- [ ] L0/Overlays 缓存命中时 p95 达标（以 v2 需求文档门槛为准）。
- [ ] Hover 不触发 L1/L2 明细请求；Brush/Toggle 不产生请求风暴。
- [ ] predicted 切换 active_run 后缓存按批次失效，不混批次。
- [ ] 动画开启时地图仍可交互；低性能设备可降级。

### 4.2 反例（Non-examples / Forbidden）
- [ ] 禁止：缓存 key 缺 access_mode 或（predicted）缺 prediction_run_id。
- [ ] 禁止：把重计算放在 FastAPI async 路由或前端主线程里直接跑。

---

## 5. 未决问题（Open Questions）
- Q1：v2 的性能门槛最终以哪套指标作为 Go/No-Go（p95 vs Web Vitals vs 地图帧率）？需要在 v2 总览/步骤总览固定。

