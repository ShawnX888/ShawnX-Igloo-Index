# 24 - 控制面板（Top Bar）- v2 实施细则

> 对应 `docs/v2/v2实现步骤总览.md` Step 24  
> 状态：Draft（可开工）  
> 版本：v2.0  
> 创建日期：2026-01-16  
> 最后更新：2026-01-16

---

## 模块名称

Top Bar（全局控制面板）：时间范围 / data_type / weather_type / 图层开关（联动矩阵输入源）

---

## 目标 / 非目标

### 目标

- 提供 v2 的“全局筛选器”入口（手动设置全局维度）：
  - `time_range`（UTC 维度输入；UI 展示可本地化）
  - `data_type`（historical/predicted）
  - `weather_type`（多天气类型维度）
  - layer toggles（weather/risk/claims/threshold…，具体枚举由 Shared Contract 固化）
- 与 UI Orchestration 协作，保证：
  - 所有变更都是“显式意图”→ 状态更新 → Query 刷新（TanStack Query）
  - brush/toggle 必须节流/去抖
  - hover 0 重请求
- 支持 Access Mode 降级：
  - Demo/Public 可限制可选 weather_type/产品数量/图层能力，保持路演节奏
  - Partner/Admin 开放更多选项
- predicted 一致性：
  - predicted 必须绑定 prediction_run_id（或 active_run 解析后回填并锁定）
  - 切换 predicted/active_run 后，L0/L1/Overlays/legend 同步刷新，不混批次

### 非目标

- 不在本细则实现区域搜索/GPS（Step 29）。
- 不在本细则实现产品选择器（Step 25）。

---

## 关联的数据产品（Data Product）

Top Bar 的变更会触发（由 Orchestration 统一调度）：

- L0 Dashboard（Step 11）
- Map Overlays（Step 12）
- L1 Region Intelligence（Step 13；按是否锁区/面板状态决定）

---

## 输入维度（最小集合）

> 维度命名必须与 Shared Contract 一致。

- `time_range`
- `data_type`
- `weather_type`
- `access_mode`
- predicted：`prediction_run_id`
- `layer_state`（layer_id → on/off；属于前端内部状态但必须可序列化/可观测）

---

## 输出形态

- Top Bar UI：
  - Time Range Picker（支持 brush/拖动，但必须节流）
  - data_type Toggle（historical/predicted）
  - weather_type Selector（枚举）
  - Layer Toggle（开关列表；禁用态可见）
- 事件输出（给 Orchestration）：
  - `topbar_change_time_range`
  - `topbar_change_data_type`
  - `topbar_change_weather_type`
  - `topbar_layer_toggle(layer_id,on/off)`

---

## Mode 规则（必须写）

- Demo/Public：
  - 可限制 weather_type 的可选集合（例如仅 rainfall）
  - 可限制 layer_id 可用集合（例如禁用 claims/threshold）
  - 禁用项必须“可见但不可用”（lock + tooltip）
- Partner/Admin：开放更多 weather_type 与 layers

硬规则：
- Mode 不是前端开关；后端必须裁剪数据产品输出；Top Bar 只决定“触发意图”与“可用性提示”。

---

## predicted 规则（必须写）

- data_type 切到 predicted 时：
  - prediction_run_id 必须由 Orchestration 锁定（来自 active_run 或用户显式选择批次）
  - Top Bar 必须能展示“当前批次 meta”（至少在 tooltip/次级信息）
- 任何 dp 请求的 query key 必含 prediction_run_id（predicted）

---

## 性能与缓存策略

### 高负载交互的治理（强制）

- Time range brush：必须节流（避免每像素一次请求）
- Layer toggle：默认只改呈现；如触发 overlays 刷新必须节流；不得触发 L2

### Query key（强制）

Top Bar 触发的刷新，query key 至少包含：

- `access_mode`
- `time_range`
- `data_type`
- `weather_type`
- predicted：`prediction_run_id`

---

## 可观测性

必须记录：

- `topbar_change_*`（含旧值→新值）
- `dp_*_query`（L0/Overlays/L1；缓存命中/耗时）

必带字段：

- `trace_id/correlation_id`
- `access_mode`
- `time_range/data_type/weather_type`
- predicted：`prediction_run_id`
- `layer_state`（变化项即可）

---

## 复用声明（必须写清楚）

### Reuse Digest（必填引用）

- `docs/v2/v2复用逻辑摘录/RD-控制面板.md`
- `docs/v2/v2复用逻辑摘录/RD-图层控制与联动边界.md`
- `docs/v2/v2复用逻辑摘录/RD-多天气类型扩展.md`
- `docs/v2/v2复用逻辑摘录/RD-共享类型与接口契约.md`
- `docs/v2/v2复用逻辑摘录/RD-性能优化.md`

---

## 验收用例（可勾选）

### 功能（必须）

- [ ] data_type/weather_type/time_range/layer toggles 可操作，且变更能驱动对应数据产品刷新（受节流保护）。

### 红线（必须）

- [ ] hover 0 重请求；brush/toggle 无请求风暴（可观测可证明）。
- [ ] predicted 不混批次（prediction_run_id 锁定且 query key 含 run_id）。
- [ ] Demo/Public 下禁用项可见但不可用；后端裁剪生效可验证。

---

## 两个“最常见失败模式”（必须写进每个模块）

### 失败模式 A：前端隐藏当权限

症状：Demo 仍能通过接口拿到高权限字段；Top Bar 只是把按钮藏起来。  
硬规则：后端裁剪；Top Bar 仅做禁用态呈现与解释。

### 失败模式 B：predicted 混批次

症状：切换到 predicted 后，部分请求未带 prediction_run_id 或沿用旧缓存。  
硬规则：query key 必含 run_id；切换时统一失效/刷新；Top Bar 显示批次 meta。

---

## 风险与回滚策略

### 风险

- brush 未节流 → 请求风暴（P0）。
- 维度命名不一致 → 缓存串用/口径漂移（P0）。

### 回滚策略

- 先回滚交互为“确认后提交”（例如 brush 结束才提交），再逐步增强实时预览。
- 强制收敛到 Shared Contract 维度命名与 Orchestration 统一调度。

