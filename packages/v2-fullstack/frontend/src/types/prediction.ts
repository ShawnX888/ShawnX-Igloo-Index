/**
 * Prediction Run 批次管理 Types
 * 
 * 本模块定义预测批次版本化的核心数据结构:
 * - PredictionRun: 批次元信息
 * - PredictionRunStatus: 批次状态
 * - ActiveRunManager: active_run切换与回滚
 * 
 * Reference:
 * - docs/v2/v2实施细则/03-Prediction-Run基线-细则.md
 * - docs/v2/v2架构升级-全栈方案.md Section 2.1.6 (预测批次表)
 * 
 * 硬规则:
 * - predicted场景下所有数据必须绑定 prediction_run_id
 * - 同一请求链路不得混用不同批次
 * - 缓存key必须包含 prediction_run_id
 * - 回滚只能通过切换 active_run (不覆盖历史数据)
 * 
 * CRITICAL: 必须与 backend/app/schemas/prediction.py 保持完全一致
 */

// ============================================================================
// Enums
// ============================================================================

/**
 * 预测批次状态
 * 
 * 说明:
 * - ACTIVE: 当前对外展示的批次(全局或按维度仅有一个active)
 * - ARCHIVED: 已归档的历史批次(可用于回滚)
 * - FAILED: 失败的批次(计算错误/数据不完整等)
 * - PROCESSING: 正在计算中(临时状态)
 */
export enum PredictionRunStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
  FAILED = 'failed',
  PROCESSING = 'processing',
}

/**
 * 预测批次来源
 * 
 * 用于审计与排障
 */
export enum PredictionRunSource {
  EXTERNAL_SYNC = 'external_sync',      // 外部数据同步触发
  MANUAL_BACKFILL = 'manual_backfill',  // 手动回填
  SCHEDULED_RERUN = 'scheduled_rerun',  // 定时重算
  ROLLBACK = 'rollback',                // 回滚操作
}

// ============================================================================
// Prediction Run Types
// ============================================================================

/**
 * Prediction Run基础信息
 */
export interface PredictionRunBase {
  /** 批次状态 */
  status: PredictionRunStatus;
  /** 批次来源 */
  source: PredictionRunSource;
  /** 备注(如回滚原因) */
  note?: string;
}

/**
 * 创建Prediction Run的请求
 */
export interface PredictionRunCreate extends PredictionRunBase {}

/**
 * Prediction Run完整信息
 * 
 * 对应数据库 prediction_runs 表
 */
export interface PredictionRun extends PredictionRunBase {
  /** 批次ID(如: run-2025-01-20-001) */
  id: string;
  /** 批次创建时间(UTC, ISO 8601) */
  created_at: string;
  
  // 可选: 批次维度范围(MVP可先做"全局单一active_run")
  /** 天气类型维度(可选,未来扩展) */
  weather_type?: string;
  /** 产品ID维度(可选,未来扩展) */
  product_id?: string;
  /** 区域范围维度(可选,未来扩展) */
  region_scope?: string;
}

/**
 * 更新Prediction Run
 */
export interface PredictionRunUpdate {
  status?: PredictionRunStatus;
  note?: string;
}

// ============================================================================
// Active Run 管理
// ============================================================================

/**
 * Active Run 信息
 * 
 * 用于响应中标注当前使用的批次
 */
export interface ActiveRunInfo {
  /** 当前active批次ID */
  active_run_id: string;
  /** 批次生成时间(UTC, ISO 8601) */
  generated_at: string;
  /** 批次来源 */
  source: PredictionRunSource;
  /** 批次适用范围说明(如: '全局' 或 '降雨产品专用') */
  scope_description?: string;
}

/**
 * 切换 Active Run 的请求
 * 
 * 用于回滚或切换到新批次
 */
export interface ActiveRunSwitchRequest {
  /** 新的active批次ID */
  new_active_run_id: string;
  /** 切换原因 */
  reason: string;
  /** 操作者 */
  operator?: string;
  /** 切换范围(如: 'global' 或 'weather_type:rainfall') */
  scope?: string;
}

/**
 * Active Run 切换记录
 * 
 * 用于审计
 */
export interface ActiveRunSwitchRecord {
  /** 切换前的active批次 */
  from_run_id: string;
  /** 切换后的active批次 */
  to_run_id: string;
  /** 切换时间(UTC, ISO 8601) */
  switched_at: string;
  /** 切换原因 */
  reason: string;
  /** 操作者 */
  operator?: string;
  /** 切换范围 */
  scope: string;
  /** 失效的缓存key数量 */
  affected_cache_keys?: number;
  /** 受影响的数据产品列表 */
  affected_data_products?: string[];
}

// ============================================================================
// Prediction Run 一致性验证
// ============================================================================

/**
 * 预测一致性检查结果
 * 
 * 用于验证同一链路中是否混用了不同批次
 */
export interface PredictionConsistencyCheck {
  /** 是否一致 */
  consistent: boolean;
  /** 检测到的所有批次ID */
  prediction_run_ids: string[];
  /** 期望的active批次ID */
  active_run_id?: string;
  /** 不一致的数据来源(如: ['l0_dashboard', 'map_overlays']) */
  inconsistent_sources?: string[];
  /** 修复建议 */
  recommendation?: string;
}

// ============================================================================
// 批次查询
// ============================================================================

/**
 * Prediction Run 查询过滤器
 */
export interface PredictionRunFilter {
  /** 按状态过滤 */
  status?: PredictionRunStatus;
  /** 按来源过滤 */
  source?: PredictionRunSource;
  /** 按天气类型过滤(如有维度) */
  weather_type?: string;
  /** 创建时间晚于(UTC, ISO 8601) */
  created_after?: string;
  /** 创建时间早于(UTC, ISO 8601) */
  created_before?: string;
  /** 返回数量限制 */
  limit?: number;
}

/**
 * Prediction Run 列表响应
 */
export interface PredictionRunListResponse {
  /** 批次列表 */
  runs: PredictionRun[];
  /** 总数 */
  total: number;
  /** 当前active批次(如有) */
  active_run?: PredictionRun;
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 生成 prediction_run_id
 * 
 * 格式: run-YYYY-MM-DD-HHMMSS
 * 
 * @param timestamp - 批次时间(默认当前时间)
 * @returns prediction_run_id
 */
export function generateRunId(timestamp?: Date): string {
  const now = timestamp || new Date();
  const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const timeStr = now.toISOString().split('T')[1].split('.')[0].replace(/:/g, ''); // HHMMSS
  
  return `run-${dateStr}-${timeStr}`;
}

/**
 * 验证 predicted 请求的 run_id
 * 
 * 硬规则:
 * - data_type='predicted' 时必须提供 prediction_run_id
 * - data_type='historical' 时不能提供 prediction_run_id
 * 
 * @returns [是否有效, 错误信息]
 */
export function validatePredictionRequest(
  dataType: string,
  predictionRunId?: string
): [boolean, string | null] {
  if (dataType === 'predicted') {
    if (!predictionRunId) {
      return [false, 'prediction_run_id is required when data_type is predicted'];
    }
  } else if (dataType === 'historical') {
    if (predictionRunId) {
      return [false, 'prediction_run_id must not be provided when data_type is historical'];
    }
  }
  
  return [true, null];
}

/**
 * 检查多个数据源的批次一致性
 * 
 * @param dataSources - 数据源名称 → prediction_run_id 的映射
 * @param expectedRunId - 期望的批次ID(如: active_run_id)
 * @returns 一致性检查结果
 */
export function checkPredictionConsistency(
  dataSources: Record<string, string | undefined>,
  expectedRunId?: string
): PredictionConsistencyCheck {
  // 过滤掉 undefined 值
  const validRunIds = Object.values(dataSources).filter(
    (runId): runId is string => runId !== undefined
  );
  
  if (validRunIds.length === 0) {
    // 所有数据源都是 undefined (可能都是 historical)
    return {
      consistent: true,
      prediction_run_ids: [],
      active_run_id: expectedRunId,
    };
  }
  
  // 检查是否所有run_id相同
  const uniqueRunIds = Array.from(new Set(validRunIds));
  const consistent = uniqueRunIds.length === 1;
  
  if (!consistent) {
    // 发现不一致
    const inconsistentSources = Object.entries(dataSources)
      .filter(([_, runId]) => runId && runId !== uniqueRunIds[0])
      .map(([source]) => source);
    
    return {
      consistent: false,
      prediction_run_ids: uniqueRunIds,
      active_run_id: expectedRunId,
      inconsistent_sources: inconsistentSources,
      recommendation: `Mixed prediction batches detected. Expected: ${expectedRunId}, Found: ${uniqueRunIds.join(', ')}. Please refresh the page.`,
    };
  }
  
  // 一致，但检查是否与expected_run_id匹配
  const actualRunId = uniqueRunIds[0];
  if (expectedRunId && actualRunId !== expectedRunId) {
    return {
      consistent: false,
      prediction_run_ids: [actualRunId],
      active_run_id: expectedRunId,
      inconsistent_sources: Object.keys(dataSources),
      recommendation: `Prediction batch mismatch. Expected active_run: ${expectedRunId}, but got: ${actualRunId}. Cache may be stale. Please refresh.`,
    };
  }
  
  return {
    consistent: true,
    prediction_run_ids: [actualRunId],
    active_run_id: expectedRunId,
  };
}

/**
 * 格式化批次ID用于显示
 * 
 * @param runId - 批次ID
 * @returns 格式化的显示文本
 */
export function formatRunIdForDisplay(runId: string): string {
  // run-2025-01-20-001 → "2025-01-20 (001)"
  const match = runId.match(/^run-(\d{4}-\d{2}-\d{2})-(.+)$/);
  if (match) {
    return `${match[1]} (${match[2]})`;
  }
  return runId;
}

/**
 * 判断批次是否过期
 * 
 * @param run - 批次信息
 * @param maxAgeHours - 最大年龄(小时)
 * @returns 是否过期
 */
export function isRunStale(run: PredictionRun, maxAgeHours: number = 24): boolean {
  const createdAt = new Date(run.created_at);
  const now = new Date();
  const ageHours = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
  
  return ageHours > maxAgeHours;
}
