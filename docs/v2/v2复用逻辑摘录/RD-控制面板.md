# Reuse Digest — 控制面板（手动选择）

> 状态：Draft  
> Reuse Type：R1（复用但重构）  
> Target Home：FE + Shared Contract  
> 绑定验收锚点：L0/L1/L2（联动输入源）、Access Mode、Prediction Run、Perf/SLO（防抖/节流）、Observability

---

## 1. v1 输入材料（仅作线索，禁止当真源）

- `docs/v1/15-控制面板实现.md`
- （关联依赖）`docs/v1/16-GPS定位功能.md`、`docs/v1/25-矢量地图动画切换.md`

---

## 2. 可复用逻辑与要求（完整重述）

### 2.1 控制面板的职责与输入输出
控制面板是“手动设置全局参数”的入口，要求可控、可解释、可恢复：
- 输入：区域数据、产品列表、当前选择状态
- 输出：更新后的选择状态（驱动地图与数据面板刷新）

### 2.2 区域选择（两种方式并存）
- **模糊搜索**：按区域名称搜索，返回可选结果。
- **层级选择**：三级下拉（国家 → 省/州 → 市/区）。
- **GPS 一键定位**：点击定位按钮后自动设置区域（依赖 GPS/反向地理编码与行政区解析闭环）。
- 区域切换后触发地图视角更新（v1 关联动画系统，fly-to + 自动计算 zoom）。

### 2.3 data_type 切换（历史/预测）与默认时间窗
- data_type 单选：historical / predicted。
- v1 给过一套“默认时间窗/可选上限”以降低用户踩坑（仅作参考，不应在 v2 被当成硬约束）：
  - historical：例如“过去 7 天（到当前时刻/或到前 1 小时）”
  - predicted：例如“未来 10 天”
  - historical 上限：例如“最多 40 天内”
- v2 的默认时间窗策略属于“路演剧本/默认值治理”，应在 `docs/v2/v2需求分析.md` 与后续 `v2项目总览/步骤总览` 中明确后，再由实现落地（本 RD 不做强行定值）。

### 2.4 时间范围选择（日期 + 小时）
时间范围由两部分组成：
- 日期选择器（from/to）
- 小时选择器（0–23）
并与 data_type 的默认值与限制联动（上节）。

### 2.5 产品选择
- 产品卡片展示：图标 + 文案
- 单选：只能选一个产品
- 支持 “more” 跳转到产品介绍页
- 选中态必须明显

### 2.6 面板交互与“与 AI 聊天窗互斥/协同”
v1 设定：控制面板与 AI 对话面板互斥显示（一个激活时另一个最小化）。
可复用要点：
- 两个入口都能改全局参数
- 参数变更必须同步到另一入口的展示（避免状态割裂）

---

## 3. v2 化适配（必须写清楚）

### 3.1 v2 的统一维度（控制面板必须覆盖）
控制面板不再只改 v1 的 selectedRegion/dateRange/dataType，而必须覆盖 v2 统一维度（按场景）：
- region_scope / region_code
- time_range
- data_type（historical/predicted）
- weather_type（v1 预留但未做；v2 已是顶栏/全局维度）
- product_id（单选）
- access_mode（不由面板随意改；但面板的“可用项/默认项”可受 mode 影响）
- prediction_run_id（predicted 场景：保持与 active_run 一致；或显式展示当前批次）

### 3.2 与 UI Orchestration 的边界（避免联动风暴）
控制面板只是“产生意图/更新全局筛选”，后续数据请求必须由 Orchestration 统一调度：
- 区域变更：允许触发 L0/L1/Overlays 刷新；L2 按打开状态决定
- 时间窗变更：节流；避免拖动就狂刷
- product 变更：会影响 risk/overlays/legend，必须同步刷新，但也必须节流

### 3.3 与 AI 聊天窗关系（v2：并存 + 可最小化）
v2 已明确聊天窗必须保留；控制面板建议：
- 两者并存，但可最小化，不强制“只开一个”
- 任何来源的参数更新都写入同一 state（Zustand），并触发同一查询刷新（TanStack Query）

### 3.4 Access Mode 的约束
- Demo/Public：可限制可选 weather_type/产品数量，保持路演节奏
- Partner/Admin：开放更全的选项
- 注意：Mode 不是前端开关；后端裁剪必须生效。控制面板只负责“呈现可用/不可用”。

### 3.5 可观测性
至少记录：
- panel_change_region / panel_change_time_range / panel_change_data_type / panel_change_weather_type / panel_change_product
- 触发哪些 dp_* 请求（L0/L1/Overlays），是否命中缓存
- 必带字段：遵循 Shared Contract 的可观测字段约定（见 `RD-共享类型与接口契约.md` 的“可观测性字段约定”），predicted 场景必须包含 `prediction_run_id`。

---

## 4. 验收用例（必须）与反例（禁止）

### 4.1 验收用例（Acceptance）
- [ ] 区域选择（模糊搜索/层级选择/GPS）均可用，并最终落到稳定 region_code。
- [ ] data_type 切换会应用默认时间窗与选择限制；用户无法选择超出范围的历史窗口（有提示）。
- [ ] 产品单选可用，切产品能驱动地图/图例/面板联动刷新（受节流保护）。
- [ ] 控制面板与 AI 聊天窗对同一组参数保持一致（互相可见当前状态）。

### 4.2 反例（Non-examples / Forbidden）
- [ ] 禁止：时间窗拖动每次变化都触发 L2 明细重请求（必须节流/按需）。
- [ ] 禁止：predicted 场景未绑定 active_run/prediction_run_id 导致混批次。
- [ ] 禁止：把 Mode 当纯前端隐藏（必须后端裁剪）。

---

## 5. 未决问题（Open Questions）
- Q1：控制面板中的 weather_type 放在面板内还是只放 Top Bar？（建议 v2：Top Bar 全局为主，面板仅呈现当前值或提供快捷入口）
- Q2：控制面板的默认值是否“固定路演剧本”还是“记住上次选择”？需要在 v2 总览确定。

