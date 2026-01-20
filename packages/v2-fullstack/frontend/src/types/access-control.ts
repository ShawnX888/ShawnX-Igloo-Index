/**
 * Access Mode 裁剪策略定义
 * 
 * 本模块定义了Access Mode的三档裁剪规则:
 * - Demo/Public: 路演默认，少数字强可视化，敏感字段范围化/聚合
 * - Partner: 合作伙伴，更深KPI，明细字段脱敏(可配置)
 * - Admin/Internal: 内部，全量字段与明细(仍需审计)
 * 
 * Reference:
 * - docs/v2/v2实施细则/02-Access-Mode裁剪基线-细则.md
 * - docs/v2/v2复用逻辑摘录/RD-分层职责与协作边界.md
 * 
 * 硬规则:
 * - 前端隐藏不是权限，后端必须执行裁剪
 * - Mode 必须影响 AI (说什么、建议什么、能执行什么)
 * - 缓存 key 必含 access_mode (否则会串数据)
 * 
 * CRITICAL: 必须与 backend/app/schemas/access_control.py 保持完全一致
 */

import { AccessMode } from './shared';

// ============================================================================
// 裁剪维度枚举
// ============================================================================

/**
 * 裁剪维度
 */
export enum PruningDimension {
  FIELD = 'field',             // 字段级裁剪: 敏感字段不可下发
  GRANULARITY = 'granularity', // 粒度级裁剪: 明细→摘要、精确值→区间
  CAPABILITY = 'capability',   // 能力级裁剪: Compare/导出/分享等动作集合
}

/**
 * 数据产品类型
 */
export enum DataProductType {
  L0_DASHBOARD = 'l0_dashboard',
  L1_REGION_INTELLIGENCE = 'l1_region_intelligence',
  L2_EVIDENCE = 'l2_evidence',
  MAP_OVERLAYS = 'map_overlays',
  AI_INSIGHTS = 'ai_insights',
}

// ============================================================================
// 裁剪策略配置
// ============================================================================

/**
 * 字段级裁剪规则
 * 
 * 用途: 定义某个Mode下允许输出的字段集合
 */
export interface FieldPruningRule {
  /** 允许输出的字段集合(allowlist) */
  allowed_fields: Set<string>;
  /** 需要脱敏的字段及其脱敏规则(如: {amount: 'range', phone: 'mask'}) */
  masked_fields?: Record<string, string>;
}

/**
 * 粒度级裁剪规则
 * 
 * 用途: 定义数据聚合/摘要的粒度策略
 */
export interface GranularityPruningRule {
  /** 是否允许明细级数据 */
  allow_detail: boolean;
  /** 是否强制聚合(True时即使请求明细也返回聚合) */
  force_aggregation: boolean;
  /** 聚合级别(如: 'summary', 'district', 'province') */
  aggregation_level?: string;
  /** 数值表示方式(如: 'exact', 'range', 'relative') */
  value_representation?: 'exact' | 'range' | 'relative';
}

/**
 * 能力级裁剪规则
 * 
 * 用途: 定义某个Mode下允许的动作集合
 */
export interface CapabilityPruningRule {
  /** 允许的能力集合(如: 'view', 'compare', 'export', 'share') */
  allowed_capabilities: Set<string>;
}

/**
 * Mode完整裁剪策略
 * 
 * 包含: 字段级 + 粒度级 + 能力级裁剪规则
 */
export interface ModePruningPolicy {
  /** 访问模式 */
  mode: AccessMode;
  /** 数据产品类型 */
  data_product: DataProductType;
  
  /** 字段级裁剪规则 */
  field_pruning: FieldPruningRule;
  /** 粒度级裁剪规则 */
  granularity_pruning: GranularityPruningRule;
  /** 能力级裁剪规则 */
  capability_pruning: CapabilityPruningRule;
  
  /** 默认展开策略(collapsed/peek/half/full) */
  default_disclosure: 'collapsed' | 'peek' | 'half' | 'full';
  /** 策略版本(用于审计与回滚) */
  policy_version: string;
}

// ============================================================================
// 越权响应策略
// ============================================================================

/**
 * 越权访问处理策略
 */
export enum UnauthorizedAccessStrategy {
  PRUNE_AND_RETURN = 'prune_and_return', // 方案A: 返回裁剪后结果
  REJECT = 'reject',                      // 方案B: 直接拒绝(403)
}

/**
 * 越权访问响应
 */
export interface UnauthorizedAccessResponse {
  strategy: UnauthorizedAccessStrategy;
  /** 是否允许访问 */
  allowed: boolean;
  /** 当前访问模式 */
  mode: AccessMode;
  /** 请求的能力 */
  requested_capability?: string;
  /** 原因说明 */
  reason: string;
  /** 建议(如何获得权限) */
  suggestion?: string;
}

// ============================================================================
// 前端UI控制
// ============================================================================

/**
 * UI能力状态
 * 
 * 用途: 前端根据Mode控制UI元素的可见性和可用性
 */
export interface UICapabilityState {
  /** 是否可见 */
  visible: boolean;
  /** 是否可用 */
  enabled: boolean;
  /** 禁用原因(当enabled=false时) */
  disabled_reason?: string;
  /** 解锁提示 */
  unlock_hint?: string;
}

/**
 * Mode UI配置
 * 
 * 用途: 定义不同Mode下的前端默认UI行为
 */
export interface ModeUIConfig {
  /** 访问模式 */
  mode: AccessMode;
  /** 数据产品类型 */
  data_product: DataProductType;
  
  /** 默认展开状态 */
  default_disclosure: 'collapsed' | 'peek' | 'half' | 'full';
  /** 允许的UI能力 */
  allowed_ui_capabilities: Record<string, UICapabilityState>;
  /** 警告提示 */
  warnings?: string[];
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 检查能力是否允许
 */
export function isCapabilityAllowed(
  capability: string,
  policy: ModePruningPolicy
): boolean {
  return policy.capability_pruning.allowed_capabilities.has(capability);
}

/**
 * 检查字段是否允许
 */
export function isFieldAllowed(
  field: string,
  policy: ModePruningPolicy
): boolean {
  return policy.field_pruning.allowed_fields.has(field);
}

/**
 * 获取UI能力状态
 * 
 * 用途: 前端根据Mode和能力获取UI元素的状态
 */
export function getUICapabilityState(
  capability: string,
  policy: ModePruningPolicy
): UICapabilityState {
  const allowed = isCapabilityAllowed(capability, policy);
  
  if (allowed) {
    return {
      visible: true,
      enabled: true,
    };
  }
  
  // 不允许的能力: "可见但不可用"策略
  return {
    visible: true,  // 仍然可见,避免演示断流
    enabled: false,
    disabled_reason: `This feature requires ${getRequiredModeForCapability(capability)} access`,
    unlock_hint: 'Contact administrator for higher access level',
  };
}

/**
 * 获取能力所需的最低Mode
 * 
 * 简化版: 实际应该从策略注册表查询
 */
function getRequiredModeForCapability(capability: string): string {
  const capabilityModeMap: Record<string, string> = {
    'view': 'Demo/Public',
    'refresh': 'Demo/Public',
    'compare': 'Partner',
    'export': 'Admin',
    'share': 'Admin',
    'configure': 'Admin',
    'audit': 'Admin',
  };
  
  return capabilityModeMap[capability] || 'Admin';
}

/**
 * 创建默认UI配置
 * 
 * 用途: 根据Mode和DataProduct生成默认的UI配置
 */
export function createDefaultUIConfig(
  mode: AccessMode,
  data_product: DataProductType,
  policy: ModePruningPolicy
): ModeUIConfig {
  const allowed_capabilities = [
    'view', 'refresh', 'compare', 'export', 'share', 'configure', 'audit'
  ];
  
  const ui_capabilities: Record<string, UICapabilityState> = {};
  for (const capability of allowed_capabilities) {
    ui_capabilities[capability] = getUICapabilityState(capability, policy);
  }
  
  const warnings: string[] = [];
  if (mode === AccessMode.DEMO_PUBLIC) {
    warnings.push('Demo mode: Some data and features are limited for demonstration purposes');
  }
  if (!policy.granularity_pruning.allow_detail) {
    warnings.push('Detail view is not available in current access mode');
  }
  
  return {
    mode,
    data_product,
    default_disclosure: policy.default_disclosure,
    allowed_ui_capabilities: ui_capabilities,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * 过滤对象字段
 * 
 * 用途: 客户端侧额外的安全过滤(虽然主要裁剪在后端)
 */
export function filterObjectFields<T extends Record<string, any>>(
  obj: T,
  policy: ModePruningPolicy
): Partial<T> {
  const filtered: Partial<T> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (isFieldAllowed(key, policy)) {
      filtered[key as keyof T] = value;
    }
  }
  
  return filtered;
}

/**
 * 获取字段脱敏规则
 */
export function getFieldMaskRule(
  field: string,
  policy: ModePruningPolicy
): string | undefined {
  return policy.field_pruning.masked_fields?.[field];
}

/**
 * 判断是否需要显示"升级提示"
 * 
 * 用途: 当用户尝试访问不允许的功能时,显示升级提示
 */
export function shouldShowUpgradeHint(
  capability: string,
  policy: ModePruningPolicy
): boolean {
  return !isCapabilityAllowed(capability, policy);
}
