# Phase 1 - Step 08: Risk Calculator (计算内核) - 实施总结

**实施日期**: 2026-01-20 | **状态**: ✅ 已完成

---

## 核心交付

1. **RiskCalculator**: 纯计算引擎,不依赖DB
2. **时间窗口聚合**: 支持hourly/daily/weekly/monthly
3. **Tier判断**: 支持>=/<= 两种运算符
4. **职责隔离**: 只读riskRules,不读payoutRules ✅
5. **输出裁剪**: 计算使用扩展窗口数据，但输出严格裁剪回 `time_range` ✅
6. **predicted 一致性**: predicted 输入必须绑定 `prediction_run_id` ✅

---

## 关键实现

```python
class RiskCalculator:
    def calculate_risk_events(
        weather_data,      # 输入: 扩展窗口数据
        risk_rules,        # 只读 riskRules
        product_id,
        product_version,
        region_timezone,   # 用于自然边界对齐（daily/weekly/monthly）
        time_range_start=None,
        time_range_end=None,
    ) -> List[RiskEvent]:
        # 1. 按窗口聚合
        # 2. 判断tier
        # 3. 返回事件列表(不含赔付金额)
        # 4. 输出裁剪回 time_range（如提供）
```

---

## 交付物清单

| 文件路径 | 说明 | 行数 |
|---|---|---|
| `packages/v2-fullstack/backend/app/services/compute/risk_calculator.py` | Risk Calculator（纯计算 + 输出裁剪 + predicted 绑定校验） | 以代码为准 |
| `packages/v2-fullstack/backend/tests/test_risk_calculator.py` | 单元测试（聚合/阈值/tier + time_range 裁剪 + predicted 必带 run_id） | 以代码为准 |

---

## 验收状态

- [x] 只读riskRules (不依赖payoutRules)
- [x] 纯函数设计 (不依赖DB Session)
- [x] 支持多种聚合方式(sum/avg/max/min)
- [x] 支持双向阈值(>= 和 <=)
- [x] 输出严格裁剪回 time_range（扩展窗口仅用于计算）
- [x] predicted 输入必须绑定 prediction_run_id（不允许空 run）

**Go/No-Go**: ✅ **GO** → Step 09

---

**下一步**: Step 09 - 风险事件表 + Risk Service
