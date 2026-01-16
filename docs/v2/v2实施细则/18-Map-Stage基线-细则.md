# 18 - Map Stage 基线（加载/交互/图层框架）- v2 实施细则

> 对应 `docs/v2/v2实现步骤总览.md` Step 18  
> 状态：Draft（可开工）  
> 版本：v2.0  
> 创建日期：2026-01-16  
> 最后更新：2026-01-16

---

## 模块名称

Map Stage（地图主舞台）基线：Map 容器 + 交互边界 + 图层框架（Google Maps JS API + deck.gl overlay + Data Layer/Markers）

---

## 目标 / 非目标

### 目标

- 建立“地图主舞台”作为 v2 UI 的**唯一核心渲染舞台**：
  - Map 实例生命周期清晰（创建一次、复用、卸载清理）
  - Overlay UI（layer controls / GPS / product selector 等）在地图之上可交互
- 固化“轻/重交互边界”（三条红线之一：交互风暴）：
  - hover：只高亮 + mini tooltip（≤3 指标，且来自已加载数据）
  - click lock / ranking click：允许触发 L1 最小集（但不强制弹起面板）
  - See more / AI CTA：才允许触发 L2（按需加载）
- 图层框架基线：
  - deck.gl overlays（可视化层）
  - Data Layer（边界 GeoJSON）
  - Advanced Markers（风险事件点位/聚合标记）
  - 图例/legend 区域固定并可被数据产品驱动
- 动画与竞态治理（来自 RD-地图模式与动画系统）：
  - 动画期间禁重请求/禁频繁图层重绘（允许后台预取但延后 commit）
  - 动画必须可取消，避免旧数据回写覆盖新状态

### 非目标

- 不在本细则实现具体某一类业务图层（天气热力/风险/理赔在后续步骤实现）。
- 不在本细则实现 Region Panel（L1/L2）UI（由 Step 26+ 承接）。

---

## 关联的数据产品（Data Product）

Map Stage 直接消费：

- Map Overlays（可渲染聚合 + legend/meta）

并通过交互触发：

- L0 Dashboard（Ranking click → map lock）
- L1 Region Intelligence（click lock → L1 最小集刷新）
- L2 Evidence（See more / CTA → 按需加载）

---

## 输入维度（最小集合）

> Map Stage 只接收“渲染所需的最小状态”，业务口径由 Orchestration 决策后注入。

- `region_scope` / `region_code`（选区与高亮）
- `time_range`
- `data_type`（historical/predicted）
- `weather_type`
- `product_id`（可选；影响风险图层可用性）
- `access_mode`
- `prediction_run_id`（predicted；影响 overlays 与 legend/meta）
- `map_mode`（2D vs vector 3D buildings；可选）
- `is_animating`（动画 gate）

---

## 输出形态

- **Map Stage 渲染输出**：
  - base map + overlay layers（deck.gl / data layer / markers）
  - legend/meta（明确单位、阈值、tier、data_type、prediction_run_id）
- **交互事件输出（给 UI Orchestration）**：
  - `map_hover(region_code?)`
  - `map_lock(region_code)`
  - `map_pan_zoom(view_state)`
  - `layer_toggle(layer_id,on/off)`

---

## Mode 规则（必须写）

- Map Stage 必须支持“可见但不可用”的能力降级（Demo/Public 常见）：
  - 例如 Claims Overlay 在 Demo 下禁用但可见（lock + tooltip 解释）
- Mode 不得仅在前端隐藏字段代替权限：
  - Map Stage 渲染的 overlays 必须来自后端 Mode-aware 输出（Step 02/12）

---

## predicted 规则（必须写）

- 当 `data_type=predicted`：
  - overlays 请求必须绑定 `prediction_run_id`（或由后端 active_run 解析并回填）
  - legend/meta 必须展示批次信息（避免解释断裂）
- 动画期间不得切换/混用不同 prediction_run 的渲染结果（延后 commit）

---

## 性能与缓存策略

### 主舞台性能门槛

- pan/zoom/hover 交互优先级最高：不得被面板展开或请求风暴拖垮
- hover 0 明细重请求（红线）

### 叠加层原则（强制）

- Map Overlays 必须“直接可渲染”（聚合/网格/hex/区域级），前端不做海量明细二次聚合
- Layer Toggle 默认只影响呈现；如确需触发 overlays 请求，必须节流/去抖，且不得触发 L2

---

## 可观测性

必须可追踪：

- `map_loaded` → `map_interaction(hover/lock)` → `dp_overlays_query` → `render_done`
- 动画链路（来自 RD-地图模式与动画系统）：
  - `map_animation_start` → `map_animation_end` → `dp_refresh_commit` → `ui_render_done`

必带字段（至少）：

- `trace_id/correlation_id`
- `access_mode`
- `region_code`、`time_range`、`data_type`、`weather_type`、`product_id`
- predicted：`prediction_run_id`
- `is_animating`、`cancelled`

---

## 复用声明（必须写清楚）

### Reuse Digest（必填引用）

- `docs/v2/v2复用逻辑摘录/RD-地图主舞台.md`
- `docs/v2/v2复用逻辑摘录/RD-地图模式与动画系统.md`
- `docs/v2/v2复用逻辑摘录/RD-图层控制与联动边界.md`

### 来自 v1 的可复用资产（R0/R1）

- 复用“地图主舞台优先”的交互原则与图层控制范式，但 v2 强制：
  - hover 0 重请求
  - 数据产品输出优先（Overlays 可渲染聚合）
  - 动画期 gate + 可取消 + 竞态治理

### 不复用内容（R3）

- 不复用“图层开关等价于重查询/拉明细”的耦合设计。

---

## 验收用例（可勾选）

### 主舞台（必须）

- [ ] 地图加载、拖拽、缩放、hover 高亮流畅；面板展开不影响地图可用性。

### 交互红线（必须）

- [ ] hover 不触发 L1/L2 明细重请求；click lock / CTA 才能触发下钻请求。

### 动画一致性（必须）

- [ ] 动画可取消，且不存在“旧数据回写覆盖新状态”的竞态；动画结束后一次性 commit 渲染。

---

## 两个“最常见失败模式”（必须写进每个模块）

### 失败模式 A：前端隐藏当权限

症状：Demo 模式下图层看起来隐藏了敏感信息，但实际接口仍返回敏感字段或明细。  
硬规则：Mode 裁剪必须由后端执行；Map Stage 只渲染后端裁剪结果。

### 失败模式 B：predicted 混批次

症状：同一屏幕的 overlays/legend/L1 使用了不同 prediction_run，导致解释断裂。  
硬规则：prediction_run_id 作为顶层状态域统一传递；渲染 commit 不能混批次（动画期延后提交）。

---

## 风险与回滚策略

### 风险

- Layer Toggle 触发请求风暴 → 地图掉帧（P0/P1）。
- 动画不可取消 → 连续操作后状态撕裂（P0）。

### 回滚策略

- 若掉帧：先降级为“只改可见性，不触发请求”；并收紧 overlays 刷新节流策略。
- 若出现竞态：引入严格的 request cancel / stale response discard，并强制动画期延后 commit。

