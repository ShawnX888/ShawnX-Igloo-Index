/**
 * 地图动画相关类型定义
 */

/**
 * 缓动函数类型
 */
export type EasingFunction = (t: number) => number;

/**
 * 动画配置选项
 */
export interface AnimationOptions {
  /** 动画时长（毫秒） */
  duration?: number;
  /** 缓动函数 */
  easing?: EasingFunction;
  /** 动画开始回调 */
  onStart?: () => void;
  /** 动画完成回调 */
  onComplete?: () => void;
  /** 动画取消回调 */
  onCancel?: () => void;
}

/**
 * 动画策略接口
 */
export interface AnimationStrategy {
  /**
   * 执行动画
   * @param map 地图实例
   * @param target 目标参数
   * @param options 动画选项
   */
  animate(
    map: google.maps.Map,
    target: unknown,
    options: AnimationOptions
  ): Promise<void>;
}

/**
 * 相机参数配置
 */
export interface CameraConfig {
  /** 中心点 */
  center: google.maps.LatLng | google.maps.LatLngLiteral;
  /** 缩放级别 */
  zoom: number;
  /** 倾斜角度 */
  tilt?: number;
  /** 朝向角度 */
  heading?: number;
}

/**
 * Fly-To 动画目标参数
 */
export interface FlyToTarget {
  /** 目标中心点 */
  center: google.maps.LatLng | google.maps.LatLngLiteral;
  /** 目标缩放级别（可选，如果提供区域信息将自动计算） */
  zoom?: number;
  /** 所选区域信息（用于自动计算合适的 zoom 以显示区域全景，优先使用） */
  region?: {
    country: string;
    province: string;
    district: string;
  };
  /** 省份信息（用于自动计算合适的 zoom 以显示省份全景，降级方案） */
  province?: {
    country: string;
    province: string;
  };
}

/**
 * Fly-To 动画选项
 */
export interface FlyToOptions extends AnimationOptions {
  /** 目标参数 */
  target: FlyToTarget;
  /** 动画策略 */
  strategy?: 'parabolic' | 'linear';
  /** 触发来源，用于特殊处理 */
  source?: 'region-search' | 'gps-location';
}

/**
 * 模式切换目标参数
 */
export interface ModeSwitchTarget {
  /** 目标模式 */
  targetMode: '2d' | '3d';
  /** 是否保持当前中心点 */
  preserveCenter?: boolean;
}

/**
 * 模式切换动画选项
 */
export interface ModeSwitchOptions extends AnimationOptions {
  /** 目标模式 */
  targetMode: '2d' | '3d';
  /** 是否保持当前中心点 */
  preserveCenter?: boolean;
}

/**
 * 初始化动画目标参数
 */
export interface InitializeTarget {
  /** 目标中心点 */
  center: google.maps.LatLng | google.maps.LatLngLiteral;
  /** 省份信息 */
  province: {
    country: string;
    province: string;
  };
}

/**
 * 初始化动画选项
 */
export interface InitializeOptions extends AnimationOptions {
  /** 目标参数 */
  target: InitializeTarget;
}

/**
 * useMapAnimation Hook 配置选项
 */
export interface UseMapAnimationOptions {
  /** 地图实例 */
  map: google.maps.Map | null;
  /** 默认动画时长（毫秒） */
  defaultDuration?: number;
  /** 默认缓动函数 */
  defaultEasing?: EasingFunction;
  /** 动画开始回调 */
  onAnimationStart?: () => void;
  /** 动画完成回调 */
  onAnimationComplete?: () => void;
  /** 动画取消回调 */
  onAnimationCancel?: () => void;
}

