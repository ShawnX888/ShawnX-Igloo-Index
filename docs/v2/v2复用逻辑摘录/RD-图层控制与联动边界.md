# Reuse Digest — 图层控制与联动边界（图层控制与联动边界）

> 状态：Draft  
> Reuse Type：R1（复用但重构）  
> Target Home：FE + Shared Contract  
> 绑定验收锚点：Overlays、Perf/SLO（节流/去抖/hover 0 重请求）、Access Mode、Observability

---

## 1. v1 输入材料（仅作线索，禁止当真源）

- `docs/v1/14-图层控制功能.md`

---

## 2. 可复用逻辑与要求（完整重述）

### 2.1 图层控制 UI 的交互范式
- 提供一个地图上的图层控制入口（v1 用 Popover + 圆形按钮，位置靠地图控制区）。
- 图层项要有明确的：
  - label
  - enabled/disabled 状态
  - checked 状态
  - 禁用态要“看得出来不可用”，避免误导

### 2.2 图层可控项与动态可用性（核心逻辑）
v1 的“动态显示/动态可用”规则可复用：
- **data_type=historical**：只允许控制“Historical Weather”相关图层
- **data_type=predicted**：只允许控制“Predicted Weather”相关图层
- **Risk Events**：仅在 **已选中产品** 时可用（否则禁用）

> 关键：不可用不是消失，而是禁用显示（v1 强调禁用态）。

### 2.3 图层状态管理与实例同步
- 图层可见性需要在状态层维护（v1 用 useState）。
- 状态变化必须同步到图层实例：
  - 热力图图层：可见性开关
  - 风险事件标记：marker map 绑定/解绑（或等价可见性开关）

---

## 3. v2 化适配（必须写清楚）

### 3.1 图层开关与 Data Product 的边界
v2 要避免“图层开关 → 触发重查询风暴”：
- Layer Toggle **默认只影响呈现**（前端可见性），不应等价于“重新计算/拉全量明细”。
- 需要请求数据时必须走数据产品（Overlays/L1/L2），并遵守节流边界（见 3.2）。

### 3.2 联动边界（必须写死）
- **Hover**：不触发任何 L1/L2 明细请求
- **Layer Toggle**：
  - 一般只改渲染
  - 如确需触发 Overlays 请求：必须节流/去抖，且不得触发 L2
- **Click lock / Pareto Click / AI Insight Click / AI CTA** 才允许触发更重的数据产品请求（L1/L2）

### 3.3 Access Mode 规则（强制）
图层能力在不同 Mode 下可能“可见但不可用”：
- Demo/Public：Claims Overlay、Details 等可能受限（但要有 lock+tooltip 的解释）
- Partner/Admin：开放更多图层与解释能力

### 3.4 可观测性（必须）
至少记录：
- layer_toggle（layer_id、on/off）
- 该 toggle 是否触发 dp_overlays_query（以及结果命中缓存/延迟）
- 必带字段：遵循 Shared Contract 的可观测字段约定（见 `RD-共享类型与接口契约.md` 的“可观测性字段约定”），predicted 场景必须包含 `prediction_run_id`。

---

## 4. 验收用例（必须）与反例（禁止）

### 4.1 验收用例（Acceptance）
- [ ] 图层控制 UI 可用：打开/关闭、状态反馈清晰、禁用态清晰。
- [ ] data_type=historical 时，仅历史天气图层可操作；data_type=predicted 时，仅预测天气图层可操作。
- [ ] 未选中产品时，风险事件图层为禁用态；选中产品后可操作。
- [ ] Layer Toggle 不导致请求风暴；hover 0 次 L1/L2 明细重请求。

### 4.2 反例（Non-examples / Forbidden）
- [ ] 禁止：Layer Toggle 直接触发 L2 明细加载。
- [ ] 禁止：禁用态“隐藏”导致用户误以为功能不存在（应可见但不可用）。

---

## 5. 未决问题（Open Questions）
- Q1：图层枚举（layer_id）与默认 preset 由哪个文档/模块统一（建议作为 Shared Contract 固化）？

