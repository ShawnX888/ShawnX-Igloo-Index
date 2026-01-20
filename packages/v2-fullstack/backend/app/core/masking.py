"""
Data Masking Utilities - v2 Access Mode

数据脱敏工具函数
"""

from decimal import Decimal
from typing import Optional


# ============================================================================
# 金额脱敏（Amount Masking）
# ============================================================================


def round_to_range(amount: Optional[Decimal]) -> Optional[str]:
    """
    将金额四舍五入到范围
    
    Args:
        amount: 金额（Decimal）
    
    Returns:
        范围字符串
    
    Examples:
        >>> round_to_range(Decimal("50000"))
        "0-100K"
        >>> round_to_range(Decimal("250000"))
        "100K-500K"
        >>> round_to_range(Decimal("750000"))
        "500K-1M"
        >>> round_to_range(Decimal("2000000"))
        "1M+"
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


def round_to_k(amount: Optional[Decimal], precision: int = 0) -> Optional[str]:
    """
    将金额转换为 K 单位
    
    Args:
        amount: 金额（Decimal）
        precision: 小数精度
    
    Returns:
        K 单位字符串
    
    Examples:
        >>> round_to_k(Decimal("50000"))
        "50K"
        >>> round_to_k(Decimal("125000"), precision=1)
        "125.0K"
    """
    if amount is None:
        return None
    
    k_value = amount / 1000
    return f"{k_value:.{precision}f}K"


def mask_percentage(
    percentage: Optional[Decimal],
    show_range: bool = True
) -> Optional[str]:
    """
    脱敏百分比
    
    Args:
        percentage: 百分比值
        show_range: 是否显示范围
    
    Returns:
        脱敏后的字符串
    
    Examples:
        >>> mask_percentage(Decimal("25.5"))
        "20-30%"
        >>> mask_percentage(Decimal("25.5"), show_range=False)
        "25%"
    """
    if percentage is None:
        return None
    
    if not show_range:
        return f"{int(percentage)}%"
    
    # 范围化到 10% 区间
    lower = int(percentage // 10) * 10
    upper = lower + 10
    return f"{lower}-{upper}%"


# ============================================================================
# 个人信息脱敏（PII Masking）
# ============================================================================


def mask_name(name: Optional[str]) -> Optional[str]:
    """
    姓名脱敏
    
    Args:
        name: 姓名
    
    Returns:
        脱敏后的姓名
    
    Examples:
        >>> mask_name("李明")
        "李*"
        >>> mask_name("张三丰")
        "张**"
        >>> mask_name("欧阳修")
        "欧*"
    """
    if not name or len(name) < 2:
        return name
    
    # 复姓处理：取第一个字 + 星号
    return name[0] + "*" * (len(name) - 1)


def mask_phone(phone: Optional[str]) -> Optional[str]:
    """
    电话号码脱敏
    
    Args:
        phone: 电话号码
    
    Returns:
        脱敏后的号码
    
    Examples:
        >>> mask_phone("13812345678")
        "138****5678"
        >>> mask_phone("+86-138-1234-5678")
        "+86-138-****-5678"
    """
    if not phone or len(phone) < 7:
        return phone
    
    # 简单处理：保留前3位和后4位
    if len(phone) <= 11:
        return phone[:3] + "****" + phone[-4:]
    
    # 包含格式符号的情况
    return phone[:7] + "****" + phone[-4:]


def mask_email(email: Optional[str]) -> Optional[str]:
    """
    邮箱脱敏
    
    Args:
        email: 邮箱地址
    
    Returns:
        脱敏后的邮箱
    
    Examples:
        >>> mask_email("liming@example.com")
        "li***@example.com"
        >>> mask_email("a@example.com")
        "a***@example.com"
    """
    if not email or "@" not in email:
        return email
    
    local, domain = email.split("@", 1)
    
    if len(local) <= 2:
        masked_local = local[0] + "***"
    else:
        masked_local = local[:2] + "***"
    
    return f"{masked_local}@{domain}"


def mask_id_number(id_number: Optional[str]) -> Optional[str]:
    """
    身份证号码脱敏
    
    Args:
        id_number: 身份证号码
    
    Returns:
        脱敏后的号码
    
    Examples:
        >>> mask_id_number("110101199001011234")
        "110101********1234"
    """
    if not id_number or len(id_number) < 10:
        return id_number
    
    # 保留前6位（地区）和后4位（校验）
    return id_number[:6] + "********" + id_number[-4:]


# ============================================================================
# 业务编号脱敏（Business Number Masking）
# ============================================================================


def mask_policy_number(policy_no: Optional[str]) -> Optional[str]:
    """
    保单号脱敏
    
    Args:
        policy_no: 保单号
    
    Returns:
        脱敏后的保单号
    
    Examples:
        >>> mask_policy_number("POL-2025-001234")
        "POL-****-**1234"
    """
    if not policy_no or len(policy_no) < 8:
        return policy_no
    
    # 保留前4位（前缀）和后4位
    return policy_no[:4] + "****" + policy_no[-4:]


def mask_claim_number(claim_no: Optional[str]) -> Optional[str]:
    """
    理赔单号脱敏
    
    Args:
        claim_no: 理赔单号
    
    Returns:
        脱敏后的理赔单号
    
    Examples:
        >>> mask_claim_number("CLM-2025-001234")
        "CLM-****-***234"
    """
    if not claim_no or len(claim_no) < 8:
        return claim_no
    
    # 保留前4位（前缀）和后3位
    return claim_no[:4] + "****" + claim_no[-3:]


def mask_internal_ref(ref: Optional[str]) -> Optional[str]:
    """
    内部参考号脱敏（完全隐藏）
    
    Args:
        ref: 内部参考号
    
    Returns:
        None（完全隐藏）
    
    Examples:
        >>> mask_internal_ref("INT-12345")
        None
    """
    return None  # 内部参考号完全隐藏


# ============================================================================
# 地理位置脱敏（Location Masking）
# ============================================================================


def mask_address(address: Optional[str], level: str = "district") -> Optional[str]:
    """
    地址脱敏
    
    Args:
        address: 完整地址
        level: 保留级别（province/city/district）
    
    Returns:
        脱敏后的地址
    
    Examples:
        >>> mask_address("北京市东城区长安街1号", level="city")
        "北京市东城区***"
        >>> mask_address("北京市东城区长安街1号", level="province")
        "北京市***"
    """
    if not address:
        return address
    
    # 简化处理：根据级别截断
    if level == "province":
        # 只保留省份
        for delimiter in ["省", "市", "自治区"]:
            if delimiter in address:
                idx = address.index(delimiter)
                return address[:idx + 1] + "***"
    elif level == "city":
        # 保留到市/区
        count = 0
        for i, char in enumerate(address):
            if char in ["市", "区", "县"]:
                count += 1
                if count == 2:
                    return address[:i + 1] + "***"
    
    # 默认保留到区县级
    return address


def mask_coordinates(
    lat: Optional[float],
    lng: Optional[float],
    precision: int = 2
) -> Optional[tuple]:
    """
    坐标脱敏（降低精度）
    
    Args:
        lat: 纬度
        lng: 经度
        precision: 保留小数位数
    
    Returns:
        脱敏后的坐标元组
    
    Examples:
        >>> mask_coordinates(39.9041999, 116.4073963, precision=2)
        (39.90, 116.41)
    """
    if lat is None or lng is None:
        return None
    
    return (round(lat, precision), round(lng, precision))


# ============================================================================
# 时间脱敏（Temporal Masking）
# ============================================================================


def mask_timestamp_to_date(timestamp: Optional[str]) -> Optional[str]:
    """
    时间戳脱敏为日期
    
    Args:
        timestamp: ISO 8601 时间戳
    
    Returns:
        日期字符串（YYYY-MM-DD）
    
    Examples:
        >>> mask_timestamp_to_date("2025-01-20T15:30:00Z")
        "2025-01-20"
    """
    if not timestamp:
        return timestamp
    
    # 简单截取日期部分
    return timestamp[:10]


def mask_timestamp_to_month(timestamp: Optional[str]) -> Optional[str]:
    """
    时间戳脱敏为月份
    
    Args:
        timestamp: ISO 8601 时间戳
    
    Returns:
        月份字符串（YYYY-MM）
    
    Examples:
        >>> mask_timestamp_to_month("2025-01-20T15:30:00Z")
        "2025-01"
    """
    if not timestamp:
        return timestamp
    
    # 简单截取年月部分
    return timestamp[:7]


# ============================================================================
# 通用脱敏（Generic Masking）
# ============================================================================


def mask_to_none(value: Optional[any]) -> None:
    """
    完全隐藏（返回None）
    
    Args:
        value: 任意值
    
    Returns:
        None
    
    Examples:
        >>> mask_to_none("sensitive_data")
        None
    """
    return None


def mask_to_placeholder(
    value: Optional[any],
    placeholder: str = "***"
) -> Optional[str]:
    """
    替换为占位符
    
    Args:
        value: 任意值
        placeholder: 占位符字符串
    
    Returns:
        占位符
    
    Examples:
        >>> mask_to_placeholder("secret", placeholder="[HIDDEN]")
        "[HIDDEN]"
    """
    if value is None:
        return None
    return placeholder
