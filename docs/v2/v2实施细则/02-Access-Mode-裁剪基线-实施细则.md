# Step 02: Access Mode 裁剪基线 - 实施细则

**步骤编号**: 02  
**步骤名称**: Access Mode 裁剪基线（后端输出裁剪规则）  
**Phase**: 0 (契约基线 + 红线固化)  
**Reuse Type**: — (新建)  
**依赖**: Step 01 (Shared Contract)  

---

## 1. 目标与交付物

### 1.1 目标

建立后端强制的Access Mode裁剪机制，防止权限旁路，确保不同受众模式下的数据安全。

### 1.2 交付物

- [ ] `docs/v2/Access-Mode-裁剪策略.md` - 裁剪策略矩阵文档
- [ ] `backend/app/core/access_control.py` - 裁剪工具函数
- [ ] `backend/app/core/pruning_rules.py` - 裁剪规则配置
- [ ] `backend/tests/core/test_access_control.py` - 单元测试

---

## 2. Access Mode 定义回顾

| Mode | 目标受众 | 数据密度 | 典型场景 |
|------|---------|---------|---------|
| **Demo** | 路演/公开演示 | 最低 | 投资人路演、公开演讲 |
| **Partner** | 合作伙伴 | 中等 | 保司/渠道合作对接 |
| **Admin** | 内部团队 | 完整 | 运营分析、系统管理 |

---

## 3. 裁剪维度（Pruning Dimensions）

### 3.1 字段级裁剪（Field-Level Pruning）

对敏感字段进行裁剪或脱敏。

| 字段类别 | Demo | Partner | Admin | 裁剪方式 |
|---------|------|---------|-------|---------|
| **基础信息** | ✅ | ✅ | ✅ | 不裁剪 |
| **金额明细** | ❌ 范围化 | ⚠️ 部分脱敏 | ✅ 完整 | `prune_amount` |
| **个人/组织信息** | ❌ | ⚠️ 部分 | ✅ | `prune_pii` |
| **内部ID/调试字段** | ❌ | ❌ | ✅ | `prune_internal` |
| **证据链明细** | ❌ | ⚠️ 聚合摘要 | ✅ | `prune_evidence` |

**示例**：

```python
# Demo 模式
{
  "policy_id": "POL-2025-001",
  "coverage_amount": None,  # ❌ 裁剪
  "holder_name": None,       # ❌ 裁剪
  "internal_ref": None       # ❌ 裁剪
}

# Partner 模式
{
  "policy_id": "POL-2025-001",
  "coverage_amount": "100000-500000",  # ⚠️ 范围化
  "holder_name": "李**",                # ⚠️ 脱敏
  "internal_ref": None                  # ❌ 裁剪
}

# Admin 模式
{
  "policy_id": "POL-2025-001",
  "coverage_amount": 250000.00,  # ✅ 完整
  "holder_name": "李明",          # ✅ 完整
  "internal_ref": "INT-12345"    # ✅ 完整
}
```

### 3.2 粒度级裁剪（Granularity-Level Pruning）

控制数据的聚合粒度。

| 数据粒度 | Demo | Partner | Admin | 裁剪方式 |
|---------|------|---------|-------|---------|
| **省级聚合** | ✅ | ✅ | ✅ | 不裁剪 |
| **区县级聚合** | ⚠️ Top5 | ✅ 完整 | ✅ 完整 | `limit_ranking` |
| **明细记录** | ❌ | ⚠️ 采样/摘要 | ✅ 完整 | `prune_details` |

**示例**：

```python
# Demo 模式 - 只返回 Top5
{
  "rankings": [
    {"rank": 1, "region": "CN-11-0101", "value": 1000},
    {"rank": 2, "region": "CN-11-0102", "value": 800},
    {"rank": 3, "region": "CN-11-0103", "value": 600},
    {"rank": 4, "region": "CN-11-0104", "value": 500},
    {"rank": 5, "region": "CN-11-0105", "value": 400},
    # ... 其余裁剪
  ],
  "total": 5  # 不显示真实总数
}

# Admin 模式 - 返回完整列表
{
  "rankings": [...],  # 所有区县
  "total": 15
}
```

### 3.3 能力级裁剪（Capability-Level Pruning）

控制可用的功能和操作。

| 能力 | Demo | Partner | Admin |
|-----|------|---------|-------|
| **查看基础数据** | ✅ | ✅ | ✅ |
| **查看L2证据链** | ❌ | ⚠️ 摘要 | ✅ |
| **导出数据** | ❌ | ⚠️ 受限 | ✅ |
| **对比分析** | ❌ | ✅ | ✅ |
| **配置修改** | ❌ | ❌ | ✅ |

---

## 4. 裁剪规则配置

### 4.1 配置文件结构

```python
# backend/app/core/pruning_rules.py

from typing import Dict, List, Optional, Callable
from app.schemas.shared import AccessMode

class FieldPruningRule:
    """字段裁剪规则"""
    field_name: str
    prune_for: List[AccessMode]
    prune_func: Optional[Callable]  # 自定义裁剪函数

class ModelPruningRules:
    """模型裁剪规则集"""
    model_name: str
    field_rules: List[FieldPruningRule]
    custom_prune_func: Optional[Callable]

# 全局裁剪规则配置
PRUNING_RULES: Dict[str, ModelPruningRules] = {
    "PolicyResponse": ...,
    "ClaimEvent": ...,
    "RiskEvent": ...,
}
```

### 4.2 规则定义示例

```python
# ClaimEvent 裁剪规则
CLAIM_EVENT_RULES = ModelPruningRules(
    model_name="ClaimEvent",
    field_rules=[
        FieldPruningRule(
            field_name="payout_amount",
            prune_for=[AccessMode.DEMO],
            prune_func=None  # 完全裁剪（设为None）
        ),
        FieldPruningRule(
            field_name="payout_amount",
            prune_for=[AccessMode.PARTNER],
            prune_func=round_to_range  # 范围化
        ),
        FieldPruningRule(
            field_name="claim_number",
            prune_for=[AccessMode.DEMO],
            prune_func=mask_claim_number  # 脱敏
        ),
    ]
)
```

---

## 5. 裁剪工具函数

### 5.1 核心裁剪函数

```python
# backend/app/core/access_control.py

from typing import TypeVar, Any, Optional
from pydantic import BaseModel
from app.schemas.shared import AccessMode
from app.core.pruning_rules import PRUNING_RULES

T = TypeVar('T', bound=BaseModel)

def prune_response(
    data: T,
    access_mode: AccessMode,
    model_name: Optional[str] = None
) -> T:
    """
    根据 Access Mode 裁剪响应数据
    
    Args:
        data: Pydantic 模型实例
        access_mode: 访问模式
        model_name: 模型名称（可选，自动推导）
    
    Returns:
        裁剪后的数据
    
    Raises:
        ValueError: 未找到裁剪规则
    """
    if access_mode == AccessMode.ADMIN:
        # Admin 模式不裁剪
        return data
    
    model_name = model_name or data.__class__.__name__
    rules = PRUNING_RULES.get(model_name)
    
    if not rules:
        # 无规则时，警告并返回原数据（安全起见应该抛出异常）
        logger.warning(f"No pruning rules found for {model_name}")
        return data
    
    # 应用字段级裁剪
    data_dict = data.model_dump()
    for field_rule in rules.field_rules:
        if access_mode in field_rule.prune_for:
            if field_rule.prune_func:
                # 自定义裁剪函数
                data_dict[field_rule.field_name] = field_rule.prune_func(
                    data_dict.get(field_rule.field_name)
                )
            else:
                # 完全裁剪（设为None）
                data_dict[field_rule.field_name] = None
    
    # 应用自定义裁剪逻辑
    if rules.custom_prune_func:
        data_dict = rules.custom_prune_func(data_dict, access_mode)
    
    # 重新验证并返回
    return data.__class__.model_validate(data_dict)
```

### 5.2 批量裁剪函数

```python
def prune_list(
    items: List[T],
    access_mode: AccessMode,
    model_name: Optional[str] = None
) -> List[T]:
    """批量裁剪列表数据"""
    return [prune_response(item, access_mode, model_name) for item in items]
```

### 5.3 粒度级裁剪函数

```python
def limit_ranking(
    rankings: List[RankingItem],
    access_mode: AccessMode,
    limit: int = 5
) -> List[RankingItem]:
    """限制排名列表长度"""
    if access_mode == AccessMode.DEMO:
        return rankings[:limit]
    return rankings
```

---

## 6. 脱敏工具函数

### 6.1 金额范围化

```python
from decimal import Decimal

def round_to_range(amount: Optional[Decimal]) -> Optional[str]:
    """
    将金额四舍五入到范围
    
    100,000 以下 -> "0-100K"
    100,000-500,000 -> "100K-500K"
    500,000-1,000,000 -> "500K-1M"
    1,000,000 以上 -> "1M+"
    """
    if amount is None:
        return None
    
    if amount < 100000:
        return "0-100K"
    elif amount < 500000:
        return "100K-500K"
    elif amount < 1000000:
        return "500K-1M"
    else:
        return "1M+"
```

### 6.2 个人信息脱敏

```python
def mask_name(name: Optional[str]) -> Optional[str]:
    """
    姓名脱敏
    
    "李明" -> "李*"
    "张三丰" -> "张**"
    """
    if not name or len(name) < 2:
        return name
    return name[0] + "*" * (len(name) - 1)

def mask_claim_number(claim_no: Optional[str]) -> Optional[str]:
    """
    理赔单号脱敏
    
    "CLM-2025-001234" -> "CLM-****-***234"
    """
    if not claim_no or len(claim_no) < 8:
        return claim_no
    return claim_no[:4] + "****" + claim_no[-3:]
```

---

## 7. API 集成

### 7.1 FastAPI 依赖注入

```python
# backend/app/api/deps.py

from fastapi import Depends, Header
from app.schemas.shared import AccessMode

async def get_access_mode(
    x_access_mode: str = Header("demo")
) -> AccessMode:
    """从请求头获取 Access Mode"""
    try:
        return AccessMode(x_access_mode.lower())
    except ValueError:
        # 默认使用 Demo 模式（最严格）
        return AccessMode.DEMO
```

### 7.2 路由层应用

```python
# backend/app/api/v1/claims.py

from fastapi import APIRouter, Depends
from app.schemas.shared import AccessMode
from app.schemas.claim import ClaimEvent
from app.core.access_control import prune_response
from app.api.deps import get_access_mode

router = APIRouter()

@router.get("/claims/{claim_id}", response_model=ClaimEvent)
async def get_claim(
    claim_id: str,
    access_mode: AccessMode = Depends(get_access_mode)
):
    # 从数据库获取原始数据
    claim = await claim_service.get_by_id(claim_id)
    
    # 应用 Access Mode 裁剪
    pruned_claim = prune_response(claim, access_mode)
    
    return pruned_claim
```

---

## 8. 响应元数据标记

所有响应必须在元数据中标记使用的 Access Mode：

```python
metadata = ResponseMetadata(
    trace_id=trace_id,
    access_mode=access_mode,  # 必须包含
    cache_hit=cache_hit,
    generated_at=datetime.utcnow()
)
```

---

## 9. 验收标准（Acceptance Criteria）

### 9.1 安全性验收

- [ ] **Demo 模式抓包测试**
  - 敏感字段（金额、个人信息）不出现在响应中
  - 内部字段不暴露
  - L2 证据链默认不返回

- [ ] **Partner 模式验证**
  - 金额字段正确范围化
  - 个人信息正确脱敏
  - 排名列表不受限

- [ ] **越权请求测试**
  - 伪造 Admin header 无效（需要额外认证）
  - 直接调用 API 返回裁剪后数据

### 9.2 功能验收

- [ ] **字段级裁剪正确**
  - 所有敏感字段按规则裁剪
  - 裁剪后数据仍可序列化

- [ ] **粒度级裁剪正确**
  - Demo 模式排名限制为 Top5
  - 明细列表正确采样/摘要

- [ ] **元数据正确**
  - 所有响应包含 `access_mode`
  - `access_mode` 与实际裁剪一致

### 9.3 性能验收

- [ ] **裁剪不影响性能**
  - 单条数据裁剪 < 1ms
  - 列表裁剪线性时间复杂度

---

## 10. 测试用例

### 10.1 单元测试

```python
# backend/tests/core/test_access_control.py

import pytest
from decimal import Decimal
from app.schemas.claim import ClaimEvent
from app.schemas.shared import AccessMode, DataType
from app.core.access_control import prune_response

def test_prune_claim_event_demo():
    """Demo 模式裁剪测试"""
    claim = ClaimEvent(
        id="claim-1",
        timestamp="2025-01-20T00:00:00Z",
        region_code="CN-11-0101",
        data_type=DataType.HISTORICAL,
        claim_number="CLM-2025-001234",
        policy_id="POL-001",
        tier_level="tier1",
        payout_percentage=Decimal("20.00"),
        payout_amount=Decimal("50000.00"),
        status="approved"
    )
    
    pruned = prune_response(claim, AccessMode.DEMO)
    
    # Demo 模式：金额裁剪
    assert pruned.payout_amount is None
    # Demo 模式：理赔单号脱敏
    assert pruned.claim_number == "CLM-****-**234"
    # 其他字段保留
    assert pruned.payout_percentage == Decimal("20.00")

def test_prune_claim_event_partner():
    """Partner 模式裁剪测试"""
    claim = ClaimEvent(...)
    pruned = prune_response(claim, AccessMode.PARTNER)
    
    # Partner 模式：金额范围化
    assert pruned.payout_amount == "0-100K"

def test_prune_claim_event_admin():
    """Admin 模式不裁剪测试"""
    claim = ClaimEvent(...)
    pruned = prune_response(claim, AccessMode.ADMIN)
    
    # Admin 模式：完全不裁剪
    assert pruned.payout_amount == Decimal("50000.00")
    assert pruned.claim_number == "CLM-2025-001234"
```

### 10.2 集成测试

```python
# backend/tests/api/test_access_mode_integration.py

from fastapi.testclient import TestClient

def test_api_with_demo_mode(client: TestClient):
    """API Demo 模式集成测试"""
    response = client.get(
        "/api/v1/claims/claim-1",
        headers={"x-access-mode": "demo"}
    )
    
    assert response.status_code == 200
    data = response.json()
    
    # 验证裁剪
    assert data["payout_amount"] is None
    assert data["metadata"]["access_mode"] == "demo"
```

---

## 11. 相关文档

- `docs/v2/v2页面设计提案.md` - Section 2.5（权限与模式）
- `docs/v2/v2技术方案.md` - Section 6（Access Mode）
- `Step 01 实施细则` - Shared Contract

---

**创建日期**: 2026-01-20  
**状态**: 📝 规范完成，待实施  
**下一步**: 实施裁剪工具函数和单元测试
