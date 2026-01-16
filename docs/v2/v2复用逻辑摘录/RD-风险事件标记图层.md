# Reuse Digest — 风险事件标记图层（风险事件标记图层）

> 状态：Draft  
> Reuse Type：R1（复用但重构）  
> Target Home：FE + BE + Shared Contract  
> 绑定验收锚点：Overlays、L1/L2、Prediction Run、Perf/SLO、Observability

---

## 1. v1 输入材料（仅作线索，禁止当真源）

- `docs/v1/13-风险事件标记图层.md`

---

## 2. 可复用逻辑与要求（完整重述）

### 2.1 两套风险标记（historical vs predicted）的视觉分层
- historical 风险用红色系（示例：#ef4444）
- predicted 风险用橙色系（示例：#f97316）
- 两者都要求：
  - 标记大小与透明度随“事件数量”变化
  - 有“风险从无到有”的动画观感（循环）

### 2.2 标记绘制与可见性规则
- 使用 Advanced Markers（HTML/CSS 自定义标记）。
- **仅在选中产品时显示风险事件标记**（v1 明确写死）。
- 对选中区域：在标记中心显示事件数量文本（白色加粗等可读性要求）。

### 2.3 事件数量的聚合数据来源（v1 的重要架构思想）
v1 明确提出：地图图层不应在渲染时从原始 riskEvents 列表做过滤/计数，而应直接消费“预聚合好的 mapMarkersData”：
- mapMarkersData = 每个行政区域的事件总数（不分 tier）
- 标记大小/透明度仍按 count/maxCount 比例计算

---

## 3. v2 化适配（必须写清楚）

### 3.1 聚合数据必须来自后端 Overlays（数据产品化）
v2 不能让前端成为计算事实源：
- 风险标记图层应消费后端 `Map Overlays` 数据产品输出（区域级/网格级聚合）。
- 前端只负责渲染与交互（hover/lock 高亮），不负责从明细 risk_events 聚合。

### 3.2 与产品规则绑定（强制）
- 风险标记的口径与“所选产品 riskRules”强绑定：
  - 未选产品：标记不可用/不显示
  - 换产品：阈值/口径/legend 必须同步更新

### 3.3 predicted 批次一致性（强制）
- predicted 风险标记必须绑定 prediction_run_id（或 active_run 解析后的等价批次）。
- 缓存 key 维度规则以 `RD-性能优化.md` 为准（至少包含 `access_mode`；predicted 额外包含 `prediction_run_id`）。
- 禁止混批次导致“标记数量/颜色/legend”与 L1 时间轴解释不一致。

### 3.4 动画与性能降级（强制）
- 动画只允许使用 transform/opacity 类 GPU 友好属性。
- 必须限制同时播放动画的标记数量（避免移动端/弱机掉帧）。
- 在 Demo/Public 模式可允许更强动效；但必须尊重 prefers-reduced-motion 与低性能降级。

### 3.5 可观测性（必须）
至少记录：
- overlays_risk_markers_loaded（数量、聚合粒度）
- render_done（marker_count、anim_enabled）
- 必带字段：遵循 Shared Contract 的可观测字段约定（见 `RD-共享类型与接口契约.md` 的“可观测性字段约定”），predicted 场景必须包含 `prediction_run_id`。

---

## 4. 验收用例（必须）与反例（禁止）

### 4.1 验收用例（Acceptance）
- [ ] 选中产品后显示风险标记；未选产品不显示（或显示禁用态提示）。
- [ ] 标记大小/透明度随事件数量变化，且选中区域显示数量文本。
- [ ] historical 与 predicted 在视觉上可明确区分（颜色系/legend）。
- [ ] predicted 切换 active_run 后，标记与 legend 同步刷新，不混批次。
- [ ] 动画开启时地图仍可流畅交互；低性能设备可降级（减少标记/禁用动画）。

### 4.2 反例（Non-examples / Forbidden）
- [ ] 禁止：前端从 risk_events 明细实时聚合来画 markers（会导致性能与口径漂移）。
- [ ] 禁止：predicted 场景未携带 prediction_run_id 仍渲染标记。
- [ ] 禁止：无限制动画导致地图帧率显著下降。

---

## 5. 未决问题（Open Questions）
- Q1：v2 的风险标记聚合粒度最终是“区县中心点”还是“网格/hex”（建议随缩放级别分层）？

