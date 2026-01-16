# Reuse Digest — 天气热力图图层（Weather Heatmap Overlay，以降雨为例）

> 状态：Draft  
> Reuse Type：R1（复用但重构）  
> Target Home：FE + BE + Shared Contract  
> 绑定验收锚点：Overlays、Perf/SLO、Prediction Run、Observability

---

## 1. v1 输入材料（仅作线索，禁止当真源）

- `docs/v1/12-降雨量热力图图层.md`

---

## 2. 可复用逻辑与要求（完整重述）

### 2.1 两套热力图（historical vs predicted）的分层表达（以 rainfall 为例）
- 同一 `weather_type` 下必须存在两套热力表达：
  - historical（示例：蓝色系）
  - predicted（示例：紫色系）
- 并且由 `data_type` 驱动显示切换：historical 模式只显示历史层，predicted 模式只显示预测层。
- 该规则对任意 `weather_type` 都成立（rain/wind/temperature...），只是单位、legend 与色阶映射不同。

### 2.2 “半透明纯色高亮”表达方式
- 热力表达基于区域 polygon 的 fillColor/fillOpacity：
  - 颜色/透明度表达数值大小（值越大越“深”）
  - 半透明设计，不遮挡底图
- v1 文档提到“径向渐变（中心→边界变浅）”，但其核心可复用要求是：
  - **同一区域内部应有“晕染”观感**
  - **区域之间差异可感知**

### 2.3 动态更新与性能目标
- 数据更新时需要驱动图层更新（尽量增量更新，避免全量重绘）。
- 目标性能（v1）：图层渲染 1s 内；切换流畅；数据更新 500ms 内完成。

---

## 3. v2 化适配（必须写清楚）

### 3.1 热力图的数据来源必须“数据产品化”
v2 不能依赖前端 mock 生成作为事实源：
- Weather Layer 的热力输入应来自后端 Overlays 数据产品（或等价聚合接口），前端只负责渲染。
- Overlays 的最小输入维度应包含：`region_scope`、`time_range`、`data_type`、`weather_type`、`access_mode`，predicted 场景额外包含 `prediction_run_id`（或由 active_run 解析后注入）。
- 输出应同时包含 legend 元信息（单位、范围、色阶说明、`weather_type`、data_type/prediction_run 信息）。

### 3.2 predicted 批次一致性（强制）
- predicted 热力层必须绑定 prediction_run_id（或 active_run 解析后的等价批次）。
- 缓存 key 维度规则以 `RD-性能优化.md` 为准（至少包含 `access_mode`；predicted 额外包含 `prediction_run_id`）。
- 禁止新旧批次混用导致颜色/legend 与事件解释不一致。

### 3.3 与边界图层的协同（强制）
- 边界图层的“选中态描边”必须在热力图开启时仍清晰可见。
- 选中区域的填充策略应避免遮挡热力表达（可借鉴 v1 的“选中+热力可见 → 填充透明”的思想）。

### 3.4 可观测性（必须）
至少记录：
- dp_overlays_query（热力数据）
- heatmap_render_done（渲染完成）
- 必带字段：遵循 Shared Contract 的可观测字段约定（见 `RD-共享类型与接口契约.md` 的“可观测性字段约定”），predicted 场景必须包含 `prediction_run_id`。

---

## 4. 验收用例（必须）与反例（禁止）

### 4.1 验收用例（Acceptance）
- [ ] historical 模式下显示蓝色系热力层；predicted 模式下显示紫色系热力层，且两者不会同时混在一个口径里。
- [ ] 热力强弱能表达数值差异；半透明不遮挡底图；选中区域边界清晰可见。
- [ ] 数据更新后，热力层能在可接受延迟内更新，且不导致地图交互掉帧。
- [ ] predicted 场景下切换 active_run 后，热力结果与 legend 同步刷新，不混批次。

### 4.2 反例（Non-examples / Forbidden）
- [ ] 禁止：predicted 热力层未绑定 prediction_run_id 仍命中缓存并渲染。
- [ ] 禁止：热力层更新触发全量重建地图实例或造成明显卡顿。

---

## 5. 未决问题（Open Questions）
- Q1：v2 是否必须实现“径向渐变”还是允许“分级色阶 + 半透明”作为 MVP（建议由体验与性能共同决定）？

