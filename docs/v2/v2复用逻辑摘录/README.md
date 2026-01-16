# v2 复用逻辑摘录（Reuse Digest）— 按模块拆分

> 目的：允许阅读 `docs/v1` 的实施细则作为输入材料，但防止 v1 的隐含前提污染 v2。  
> 所有可复用逻辑/要求必须先写入本目录下的 Reuse Digest，并完成 **v2 化重述 + 验收/反例**，再进入 `v2实施细则`。

---

## 1. 目录规范

每个模块一个文件（统一放在本目录下）：

```
docs/v2/v2复用逻辑摘录/
  RD-<模块名>.md
```

模块名建议采用稳定且可检索的命名，例如：
- `map-stage`
- `region-boundary`
- `product-library`
- `risk-calculation`
- `weather-data`
- `claims-overlay`
- `ai-chat-and-insights`
- `gps-and-reverse-geocoding`

---

## 2. 强制规则

- **R0/R1 模块必须有 Reuse Digest**（见 `docs/v2/v2迁移分层矩阵.md` 与 `docs/v2/v2文档治理与实施拆解方针.md`）。
- **禁止**在 `v2实施细则` 中直接引用/依赖 v1 文档路径或段落作为依据。
- Reuse Digest 必须用 v2 统一语言重述：
  - L0/L1/L2、Access Mode、Data Type、Prediction Run（prediction_run_id/active_run）、Data Product
  - 输入维度：region_scope/region_code/time_range/data_type/weather_type/product_id/access_mode/prediction_run_id
- Reuse Digest 必须包含：
  - 可复用逻辑与约束（完整重述）
  - v2 适配后的契约（输入/输出/边界）
  - 验收用例 + 反例（禁止行为/常见误用）

---

## 3. 模板

复制 `docs/v2/v2复用逻辑摘录/TEMPLATE-复用逻辑摘录.md` 为新文件，并按模块命名，例如：
- `docs/v2/v2复用逻辑摘录/RD-map-stage.md`
- `docs/v2/v2复用逻辑摘录/RD-gps-and-reverse-geocoding.md`

