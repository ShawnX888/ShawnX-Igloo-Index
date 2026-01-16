# 25 - 产品选择器（Product Selector）- v2 实施细则

> 对应 `docs/v2/v2实现步骤总览.md` Step 25  
> 状态：Draft（可开工）  
> 版本：v2.0  
> 创建日期：2026-01-16  
> 最后更新：2026-01-16

---

## 模块名称

Product Selector（产品选择器）：按 weather_type 过滤、单选 product_id、联动 risk overlays/legend/L1

---

## 目标 / 非目标

### 目标

- 提供稳定的产品选择入口（Map 上浮层或 Top Bar 旁）：
  - 产品单选（MVP）
  - 按 `weather_type` 过滤可选产品（v2 强制）
  - 支持 “More / 产品介绍页”跳转（见 `RD-页面间联动.md`）
- 数据来源权威化：
  - 产品列表必须来自后端 Product Service（Step 05），前端不读取静态产品库文件作为真源
- 与风险标记/阈值解释强绑定：
  - 未选中产品：Risk Layer 禁用（可见但不可用）
  - 选中产品：Risk Layer 可用，且与产品 `riskRules` 口径一致（weather_type/timeWindow/thresholds）
  - 换产品：overlays/legend/L1 timeline 同步刷新（受节流保护）
- Access Mode 与降级：
  - Demo/Public：可限制可选产品集合（1–3 个）保持路演节奏
  - Partner/Admin：开放更多产品与规则信息（后端裁剪）

### 非目标

- 不在本细则实现产品详情页（Product Intro page）的内容（属于页面与内容模块）。
- 不在本细则实现 claim/payout 的展示（Phase 3 以后）。

---

## 关联的数据产品（Data Product）

直接影响：

- Map Overlays（Step 12：风险/阈值/legend 口径随 product_id 变化）
- L1 Region Intelligence（Step 13：risk 泳道口径随 product_id 变化）
- Risk Layer（Step 23：仅在选中 product_id 时可用）

---

## 输入维度（最小集合）

- `weather_type`（过滤产品列表）
- `product_id`（单选）
- `access_mode`
- `data_type`
- predicted：`prediction_run_id`

---

## 输出形态

### UI 输出

- 产品列表（卡片/下拉均可）：
  - name/icon/简述（最小集）
  - 支持 weather_type 过滤
  - disabled 状态清晰（不可选原因可解释）
- 选择结果：
  - `selected_product_id` 写入 Orchestration（Zustand）

### 交互输出（给 Orchestration）

- `product_select(product_id)`
- `product_clear()`
- `product_more_click(product_id)`（跳转到产品页或打开产品介绍）

---

## Mode 规则（必须写）

- Demo/Public：
  - 可限制产品集合（例如推荐集 1–3 个）
  - 可隐藏复杂 `payoutRules`（或只给教育摘要），避免误导
- Partner/Admin：
  - 可展示更完整的产品信息（仍需遵守敏感字段策略）

硬规则：
- 产品信息也属于受控数据：裁剪必须由后端完成并可审计（见 `RD-产品库与规则契约.md`）。

---

## predicted 规则（必须写）

- predicted 下切产品：
  - 必须保持 prediction_run_id 不变（除非用户显式切 run）
  - overlays/L1 的 query key 必含 prediction_run_id，避免混批次

---

## 性能与缓存策略

- 产品列表请求可缓存（但必须区分 access_mode 与 weather_type 过滤口径）
- 切产品属于高频交互，必须：
  - 由 Orchestration 节流/去抖触发 dp 刷新
  - 避免切换瞬间触发 L2 明细（禁止）

---

## 可观测性

必须记录：

- `product_select` / `product_clear` / `product_more_click`
- 触发的 `dp_overlays_query` / `dp_l1_query`（缓存命中/耗时）

必带字段：

- `trace_id/correlation_id`
- `access_mode`
- `weather_type/data_type`
- `product_id`
- predicted：`prediction_run_id`
- `product_version/rules_hash`（至少在 dp 请求/响应 meta 或日志中可追溯）

---

## 复用声明（必须写清楚）

### Reuse Digest（必填引用）

- `docs/v2/v2复用逻辑摘录/RD-产品库与规则契约.md`
- `docs/v2/v2复用逻辑摘录/RD-多天气类型扩展.md`
- `docs/v2/v2复用逻辑摘录/RD-控制面板.md`
- `docs/v2/v2复用逻辑摘录/RD-页面间联动.md`
- `docs/v2/v2复用逻辑摘录/RD-性能优化.md`
- `docs/v2/v2复用逻辑摘录/RD-共享类型与接口契约.md`

---

## 验收用例（可勾选）

### 功能（必须）

- [ ] 产品列表来自后端；按 weather_type 过滤；单选可用；More 跳转可用。
- [ ] 未选产品时 Risk Layer 禁用（可见但不可用）；选中后启用并刷新 overlays/legend。

### 红线（必须）

- [ ] 切产品不触发 L2 明细；无请求风暴；hover 仍为 0 重请求（全链路遵守）。
- [ ] predicted 不混批次（run_id 锁定且 query key 含 run_id）。
- [ ] Demo/Public 下产品与规则信息裁剪生效可验证。

---

## 两个“最常见失败模式”（必须写进每个模块）

### 失败模式 A：前端隐藏当权限

症状：Demo 通过接口仍可拿到全量产品规则/敏感字段，前端只是不展示。  
硬规则：后端裁剪；前端做降级 UX 与解释。

### 失败模式 B：predicted 混批次

症状：切产品后 overlays 命中旧 run 的缓存，导致 risk markers 与 L1 解释不一致。  
硬规则：query key 必含 prediction_run_id；切换时统一失效/刷新；meta 显示批次。

---

## 风险与回滚策略

### 风险

- 产品规则信息不一致（products.weatherType vs riskRules.weatherType）→ 口径错位（P0）。
- 切产品触发过多刷新 → 掉帧/请求风暴（P0/P1）。

### 回滚策略

- 若规则不一致：以 Product Service 校验 gate 阻断发布（见 RD）；并回滚到上一个可用版本。
- 若性能不稳：先收敛到“确认后提交”或更强节流，并减少同时刷新的数据产品集合。

