# Reuse Digest — 地图主舞台（初始化/容器/基础交互）

> 状态：Draft  
> Reuse Type：R1（复用但重构）  
> Target Home：FE + Shared Contract  
> 绑定验收锚点：Overlays、Perf/SLO、Compliance、Observability

---

## 1. v1 输入材料（仅作线索，禁止当真源）

- `docs/v1/03-Google-Maps-API配置与初始化.md`
- `docs/v1/10-地图容器替换.md`

---

## 2. 可复用逻辑与要求（完整重述）

### 2.1 Maps JS API 的加载方式
- 必须采用“按需动态加载库”的思路（v1 使用 `google.maps.importLibrary`），避免静态 script 粗暴加载。
- 必须加载的核心库：
  - maps（Map）
  - marker（AdvancedMarkerElement 等，供风险/事件标记）
  - data（Data Layer，供边界/geojson）

### 2.2 地图实例的生命周期管理
- 地图容器是一个明确宽高的 div。
- 地图实例存储在 ref 中，供后续图层与控件使用。
- 组件卸载时需要清理（至少解除绑定/移除图层），避免内存泄漏。

### 2.3 容器替换与 overlay 保持
- v1 从 SVG 模拟地图切换到 Google Map 容器后，必须保留 overlay UI：
  - 图层控制按钮位置不变或等价替换
  - GPS 按钮位置与交互保持
  - overlay 必须在地图上方、可点击且 z-index 正确

### 2.4 默认视角与配置
- 默认中心点与缩放（v1 用雅加达作为默认例子）；
- 支持 Map ID（自定义样式）；
- 交互必须流畅（缩放、拖拽）；

---

## 3. v2 化适配（必须写清楚）

### 3.1 v2 的地图加载与 Key 注入（只保留“原则”，不保留 v1 具体实现细节）
- Key 必须来自 v2 的环境变量策略（Next.js），禁止硬编码。
- Maps JS API 推荐仍采用动态加载（importLibrary / loader），但 v2 必须与合规 gate（key 限制、成本监控、attribution）绑定。

### 3.2 地图主舞台的体验约束
- 地图交互优先级最高：
  - Hover/Drag/Zoom 不能被面板/请求风暴拖慢
  - L1/L2 展开不得导致地图不可用
- Hover 属于轻交互：不应因为 hover 触发 L1/L2 明细重请求（最多 tooltip + 边界高亮）

### 3.3 Shared Contract：地图层与数据产品的边界
- Map Stage 只负责渲染与交互（输入事件 → UI Orchestration）。
- 数据聚合（Overlays/L0）应优先由后端数据产品提供，前端不做海量明细二次聚合。

### 3.4 可观测性
需要可追踪：
- map_loaded → map_interaction（hover/lock/fly-to）→ dp_overlays_query → render_done
- 必带字段：遵循 Shared Contract 的可观测字段约定（见 `RD-共享类型与接口契约.md` 的“可观测性字段约定”），predicted 场景必须包含 `prediction_run_id`。

---

## 4. 验收用例（必须）与反例（禁止）

### 4.1 验收用例（Acceptance）
- [ ] 地图可加载并可交互（drag/zoom），且 overlay（图层控制、GPS、产品选择等）可正常点击。
- [ ] 地图实例生命周期清晰：初始化一次、卸载清理，不重复创建导致卡顿。
- [ ] Hover 不触发 L1/L2 明细重请求；地图交互不掉帧（符合 v2 的性能门槛）。

### 4.2 反例（Non-examples / Forbidden）
- [ ] 禁止：在地图组件内直接耦合重计算或密集数据请求（应由数据产品层与 Orchestration 统一调度）。
- [ ] 禁止：每次参数变化都重建地图实例（应保留 map 实例，仅更新图层/样式/视角）。

---

## 5. 未决问题（Open Questions）
- Q1：默认区域与默认 zoom 的 v2 策略（Demo 口径是否固定一套“路演剧本默认区域”）？
- Q2：Map ID / 样式策略是否需要按 Access Mode 切换（例如 Demo 更具观感）？

