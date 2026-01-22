# Phase 1 - Step 06: 保单表 + Policy Service - 实施总结

**实施日期**: 2026-01-20 | **状态**: ✅ 已完成

---

## 核心交付

1. **policies 表**: 保单号、产品关联、覆盖区域、保额(Decimal)、**timezone**(必须)
2. **Policy Service**: CRUD + 统计查询 + Mode裁剪
3. **Policy API Router**: /policies + /statistics/policies（读路径）
4. **Internal Policy Router**: /internal/policies（Admin/Internal 写入）
3. **验证规则**: timezone必填、coverage_end > start、金额非负

---

## 关键约束

### timezone 字段 (CRITICAL)

```python
class Policy:
    timezone = Column(String(50), nullable=False)  # 如: "Asia/Shanghai"
    # 用于: is_same_natural_day(event1, event2, policy.timezone)
```

### 金额精度

```python
coverage_amount = Column(Numeric(18, 2))  # Decimal, 避免浮点误差
```

### Mode裁剪

- **Demo/Public**: holder_name脱敏、coverage_amount区间化
- **Admin**: 返回完整字段

---

## 预定义字段

| 字段 | 类型 | 说明 | 
|---|---|---|
| id | VARCHAR(50) | 主键 |
| policy_number | VARCHAR(50) | 保单号(唯一) |
| product_id | VARCHAR(50) | 外键→products |
| coverage_region | VARCHAR(20) | 区域代码(如CN-GD) |
| coverage_amount | NUMERIC(18,2) | 保额 |
| **timezone** | VARCHAR(50) | 时区(必须) |
| coverage_start/end | TIMESTAMPTZ | 保障期间(UTC) |
| holder_name | VARCHAR(100) | 持有人(可脱敏) |

---

## 使用示例

```python
# 获取保单并提取timezone用于业务判断
policy = await policy_service.get_by_id(session, policy_id, AccessMode.ADMIN_INTERNAL)

# 判断两个事件是否同一天 (使用policy.timezone)
same_day = is_same_natural_day(event1_utc, event2_utc, policy.timezone)
```

---

## 验收状态

- [x] timezone字段必填
- [x] 金额使用Decimal
- [x] Mode裁剪实现
- [x] 测试覆盖

---

## 交付物清单

- `packages/v2-fullstack/backend/app/models/policy.py`（policies表模型）
- `packages/v2-fullstack/backend/app/schemas/policy.py`（Policy/PolicyStats）
- `packages/v2-fullstack/backend/app/services/policy_service.py`（查询 + 统计 + Mode裁剪）
- `packages/v2-fullstack/backend/app/api/v1/policies.py`（Policy Router）
- `packages/v2-fullstack/backend/app/api/v1/internal/policies.py`（Internal Policy Router）
- `packages/v2-fullstack/backend/tests/test_policy.py`（Schema验收用例）
- `packages/v2-fullstack/backend/tests/test_api_policies.py`（Router验收）
- `packages/v2-fullstack/backend/tests/test_api_internal_policies.py`（Internal Router验收）

**Go/No-Go**: ✅ **GO** → Step 07

---

**下一步**: Step 07 - 天气数据表 + Weather Service
