/**
 * Access Control工具函数 (前端)
 * 
 * 提供Mode验证、UI状态控制等工具函数。
 * 
 * Reference:
 * - docs/v2/v2实施细则/02-Access-Mode裁剪基线-细则.md
 * 
 * CRITICAL:
 * - 前端只控制UI展示，真正的权限裁剪在后端
 * - 前端验证只是为了更好的UX，不能替代后端验证
 */

import { AccessMode, DataProductType, ModePruningPolicy } from '@/types';

// ============================================================================
// Mode配置管理
// ============================================================================

/**
 * Mode配置管理器
 */
export class ModeConfig {
  /**
   * 默认Mode (路演场景)
   */
  static readonly DEFAULT_MODE = AccessMode.DEMO_PUBLIC;
  
  /**
   * 环境变量键名
   */
  static readonly ENV_KEY = 'NEXT_PUBLIC_IGLOO_ACCESS_MODE';
  
  /**
   * 获取当前Access Mode
   * 
   * 优先级:
   * 1. 环境变量 NEXT_PUBLIC_IGLOO_ACCESS_MODE
   * 2. localStorage (用户选择)
   * 3. 系统默认值 (DEMO_PUBLIC)
   * 
   * @returns 当前的Access Mode
   */
  static getCurrentMode(): AccessMode {
    // 1. 尝试从环境变量读取
    const envMode = process.env.NEXT_PUBLIC_IGLOO_ACCESS_MODE;
    if (envMode && this.validateMode(envMode)) {
      console.info(`[ModeConfig] Loaded from env: ${envMode}`);
      return envMode as AccessMode;
    }
    
    // 2. 尝试从localStorage读取 (仅在浏览器环境)
    if (typeof window !== 'undefined') {
      const storedMode = localStorage.getItem('igloo_access_mode');
      if (storedMode && this.validateMode(storedMode)) {
        console.info(`[ModeConfig] Loaded from localStorage: ${storedMode}`);
        return storedMode as AccessMode;
      }
    }
    
    // 3. 使用默认值
    console.info(`[ModeConfig] Using default: ${this.DEFAULT_MODE}`);
    return this.DEFAULT_MODE;
  }
  
  /**
   * 设置Access Mode (仅存储到localStorage)
   * 
   * CRITICAL: 这只是前端本地设置，真正的权限控制在后端
   * 
   * @param mode - 要设置的Mode
   */
  static setMode(mode: AccessMode): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('igloo_access_mode', mode);
      console.info(`[ModeConfig] Mode set to: ${mode}`);
      
      // 触发Mode变更事件 (可选)
      window.dispatchEvent(new CustomEvent('access-mode-changed', {
        detail: { mode }
      }));
    }
  }
  
  /**
   * 验证Mode字符串是否有效
   */
  static validateMode(mode: string): boolean {
    return Object.values(AccessMode).includes(mode as AccessMode);
  }
  
  /**
   * 判断当前Mode是否满足所需Mode级别
   * 
   * 级别顺序: DEMO_PUBLIC < PARTNER < ADMIN_INTERNAL
   */
  static isModeAtLeast(
    currentMode: AccessMode,
    requiredMode: AccessMode
  ): boolean {
    const hierarchy: Record<AccessMode, number> = {
      [AccessMode.DEMO_PUBLIC]: 0,
      [AccessMode.PARTNER]: 1,
      [AccessMode.ADMIN_INTERNAL]: 2,
    };
    
    return hierarchy[currentMode] >= hierarchy[requiredMode];
  }
}

// ============================================================================
// UI控制辅助函数
// ============================================================================

/**
 * 判断UI元素是否应该显示
 * 
 * "可见但不可用"策略: 即使不允许，也显示(但禁用)，避免演示断流
 */
export function shouldShowUIElement(
  capability: string,
  policy: ModePruningPolicy
): boolean {
  // 所有UI元素都可见
  return true;
}

/**
 * 判断UI元素是否可用
 */
export function isUIElementEnabled(
  capability: string,
  policy: ModePruningPolicy
): boolean {
  return policy.capability_pruning.allowed_capabilities.has(capability);
}

/**
 * 获取禁用提示
 */
export function getDisabledHint(
  capability: string,
  currentMode: AccessMode
): string {
  const requiredMode = getRequiredModeForCapability(capability);
  return `This feature requires ${requiredMode} access. Current mode: ${currentMode}`;
}

/**
 * 获取能力所需的最低Mode
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

// ============================================================================
// React Hook辅助 (类型定义)
// ============================================================================

/**
 * Mode配置Hook返回类型
 */
export interface UseModeConfigReturn {
  /** 当前Mode */
  mode: AccessMode;
  /** 是否正在加载 */
  isLoading: boolean;
  /** 切换Mode */
  setMode: (mode: AccessMode) => void;
  /** 判断是否满足所需Mode级别 */
  isModeAtLeast: (requiredMode: AccessMode) => boolean;
}

// 实际的Hook实现将在对应的hooks目录中
// export function useModeConfig(): UseModeConfigReturn { ... }

// ============================================================================
// 导出便捷函数
// ============================================================================

/**
 * 获取当前Mode (服务器端/客户端通用)
 */
export function getCurrentMode(): AccessMode {
  return ModeConfig.getCurrentMode();
}

/**
 * 检查能力是否允许 (前端快速检查)
 * 
 * CRITICAL: 这只是前端优化，真正的权限检查在后端
 */
export function canUseCapability(
  capability: string,
  mode: AccessMode
): boolean {
  // 简化版: 根据能力和Mode快速判断
  // 实际应该从完整的策略注册表查询
  const demoCapabilities = ['view', 'refresh'];
  const partnerCapabilities = [...demoCapabilities, 'compare'];
  const adminCapabilities = [...partnerCapabilities, 'export', 'share', 'configure', 'audit'];
  
  switch (mode) {
    case AccessMode.DEMO_PUBLIC:
      return demoCapabilities.includes(capability);
    case AccessMode.PARTNER:
      return partnerCapabilities.includes(capability);
    case AccessMode.ADMIN_INTERNAL:
      return adminCapabilities.includes(capability);
    default:
      return false;
  }
}
