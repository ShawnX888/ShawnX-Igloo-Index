/**
 * Prediction Run 管理工具 (前端)
 * 
 * 职责:
 * - 管理 active_run 的获取和显示
 * - 验证 prediction_run_id 一致性
 * - 提供批次切换UI反馈
 * 
 * Reference:
 * - docs/v2/v2实施细则/03-Prediction-Run基线-细则.md
 * 
 * CRITICAL:
 * - 前端不能自行选择批次，必须使用后端返回的 active_run_id
 * - 批次切换必须由后端执行，前端只负责触发和反馈
 */

import {
  PredictionRun,
  PredictionRunStatus,
  PredictionConsistencyCheck,
  ActiveRunInfo,
  ActiveRunSwitchRequest,
  checkPredictionConsistency,
  formatRunIdForDisplay,
  isRunStale,
} from '@/types/prediction';

// ============================================================================
// Active Run 状态管理
// ============================================================================

/**
 * Active Run 上下文
 * 
 * 用于在React组件树中传递当前active_run信息
 */
export interface ActiveRunContext {
  /** 当前active批次 */
  activeRun: PredictionRun | null;
  /** 是否正在加载 */
  isLoading: boolean;
  /** 刷新active_run */
  refresh: () => Promise<void>;
}

/**
 * 创建默认的ActiveRunContext
 */
export function createDefaultActiveRunContext(): ActiveRunContext {
  return {
    activeRun: null,
    isLoading: false,
    refresh: async () => {
      console.warn('[ActiveRunContext] refresh() not implemented');
    },
  };
}

// ============================================================================
// 批次一致性检查
// ============================================================================

/**
 * 数据源批次收集器
 * 
 * 用于在前端收集各数据产品返回的 prediction_run_id
 */
export class PredictionRunCollector {
  private sources: Map<string, string | undefined> = new Map();
  private expectedRunId?: string;
  
  /**
   * 设置期望的 active_run_id
   */
  setExpectedRunId(runId: string | undefined): void {
    this.expectedRunId = runId;
  }
  
  /**
   * 记录数据源的 run_id
   * 
   * @param source - 数据源名称(如: 'l0_dashboard', 'map_overlays')
   * @param runId - 该数据源返回的 prediction_run_id
   */
  record(source: string, runId: string | undefined): void {
    this.sources.set(source, runId);
  }
  
  /**
   * 检查一致性
   * 
   * @returns 一致性检查结果
   */
  check(): PredictionConsistencyCheck {
    const sourcesObj: Record<string, string | undefined> = {};
    this.sources.forEach((runId, source) => {
      sourcesObj[source] = runId;
    });
    
    return checkPredictionConsistency(sourcesObj, this.expectedRunId);
  }
  
  /**
   * 重置收集器
   */
  reset(): void {
    this.sources.clear();
    this.expectedRunId = undefined;
  }
  
  /**
   * 获取所有记录的批次ID
   */
  getAllRunIds(): string[] {
    return Array.from(this.sources.values()).filter(
      (runId): runId is string => runId !== undefined
    );
  }
}

// ============================================================================
// 批次警告与提示
// ============================================================================

/**
 * 批次状态警告
 */
export interface RunStatusWarning {
  /** 警告级别 */
  level: 'info' | 'warning' | 'error';
  /** 警告消息 */
  message: string;
  /** 建议操作 */
  action?: string;
}

/**
 * 检查批次状态并返回警告
 * 
 * @param run - 批次信息
 * @param activeRunId - 当前active批次ID
 * @returns 警告信息(如有)
 */
export function checkRunStatusWarnings(
  run: PredictionRun,
  activeRunId?: string
): RunStatusWarning[] {
  const warnings: RunStatusWarning[] = [];
  
  // 1. 检查批次状态
  if (run.status === PredictionRunStatus.FAILED) {
    warnings.push({
      level: 'error',
      message: 'This prediction batch failed during calculation',
      action: 'Please contact administrator or switch to a different batch',
    });
  }
  
  if (run.status === PredictionRunStatus.PROCESSING) {
    warnings.push({
      level: 'info',
      message: 'This prediction batch is still being calculated',
      action: 'Data may be incomplete. Please wait or refresh later.',
    });
  }
  
  // 2. 检查是否为active
  if (activeRunId && run.id !== activeRunId) {
    warnings.push({
      level: 'warning',
      message: 'You are viewing an archived prediction batch',
      action: `Switch to active batch (${formatRunIdForDisplay(activeRunId)}) for latest predictions`,
    });
  }
  
  // 3. 检查批次年龄
  if (run.status === PredictionRunStatus.ACTIVE && isRunStale(run, 48)) {
    warnings.push({
      level: 'warning',
      message: 'Active prediction batch is more than 48 hours old',
      action: 'Consider triggering a new prediction update',
    });
  }
  
  return warnings;
}

// ============================================================================
// UI辅助函数
// ============================================================================

/**
 * 格式化批次状态用于显示
 */
export function formatRunStatus(status: PredictionRunStatus): string {
  const statusMap: Record<PredictionRunStatus, string> = {
    [PredictionRunStatus.ACTIVE]: 'Active',
    [PredictionRunStatus.ARCHIVED]: 'Archived',
    [PredictionRunStatus.FAILED]: 'Failed',
    [PredictionRunStatus.PROCESSING]: 'Processing',
  };
  
  return statusMap[status];
}

/**
 * 格式化批次来源用于显示
 */
export function formatRunSource(source: PredictionRunSource): string {
  const sourceMap: Record<PredictionRunSource, string> = {
    [PredictionRunSource.EXTERNAL_SYNC]: 'External Sync',
    [PredictionRunSource.MANUAL_BACKFILL]: 'Manual Backfill',
    [PredictionRunSource.SCHEDULED_RERUN]: 'Scheduled Rerun',
    [PredictionRunSource.ROLLBACK]: 'Rollback',
  };
  
  return sourceMap[source];
}

/**
 * 获取批次状态的颜色类名
 * 
 * 用于UI展示
 */
export function getRunStatusColor(status: PredictionRunStatus): string {
  const colorMap: Record<PredictionRunStatus, string> = {
    [PredictionRunStatus.ACTIVE]: 'text-green-500',
    [PredictionRunStatus.ARCHIVED]: 'text-gray-500',
    [PredictionRunStatus.FAILED]: 'text-red-500',
    [PredictionRunStatus.PROCESSING]: 'text-yellow-500',
  };
  
  return colorMap[status];
}
