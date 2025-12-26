/**
 * 地图动画 React Hook
 * 
 * 提供简洁的 API 用于执行各种地图动画效果
 */

import { useRef, useCallback, useEffect, useState } from 'react';
import { MapAnimationEngine } from '../lib/mapAnimationEngine';
import { InitializeStrategy } from '../lib/mapAnimationStrategies';
import type {
  UseMapAnimationOptions,
  FlyToOptions,
  ModeSwitchOptions,
  InitializeOptions,
  CameraConfig,
} from '../types/animation';

/**
 * useMapAnimation Hook
 * 
 * 提供地图动画功能，包括：
 * - 页面初始化动画（高空伪飞入）
 * - 远距离地址切换（Fly-To）
 * - 2D/3D 模式切换
 * 
 * @param options Hook 配置选项
 * @returns 动画控制方法和状态
 */
export function useMapAnimation(options: UseMapAnimationOptions) {
  const {
    map,
    defaultDuration = 1500,
    defaultEasing,
    onAnimationStart,
    onAnimationComplete,
    onAnimationCancel,
  } = options;

  // 动画引擎实例
  const engineRef = useRef<MapAnimationEngine | null>(null);
  // 动画策略实例
  const initializeStrategyRef = useRef<InitializeStrategy | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  // 初始化动画引擎和策略
  useEffect(() => {
    if (!map) {
      engineRef.current = null;
      initializeStrategyRef.current = null;
      return;
    }

    const engine = new MapAnimationEngine();
    engineRef.current = engine;
    initializeStrategyRef.current = new InitializeStrategy(engine);

    return () => {
      // 清理资源
      engine.dispose();
      engineRef.current = null;
      initializeStrategyRef.current = null;
    };
  }, [map]);

  /**
   * 获取当前相机配置
   */
  const getCurrentCameraConfig = useCallback((): CameraConfig => {
    if (!map) {
      throw new Error('Map instance is not available');
    }

    const center = map.getCenter();
    if (!center) {
      throw new Error('Map center is not available');
    }

    return {
      center,
      zoom: map.getZoom() ?? 10,
      tilt: map.getTilt() ?? 0,
      heading: map.getHeading() ?? 0,
    };
  }, [map]);

  /**
   * 页面初始化动画（高空伪飞入）
   * 
   * 从大洲视图平滑过渡到省份视图
   */
  const initialize = useCallback(
    async (options: InitializeOptions): Promise<void> => {
      if (!map || !initializeStrategyRef.current) {
        console.warn('Map or initialize strategy is not available');
        return;
      }

      try {
        setIsAnimating(true);
        onAnimationStart?.();

        // 使用初始化策略执行动画
        await initializeStrategyRef.current.animate(
          map,
          options.target,
          {
            duration: options.duration ?? defaultDuration,
            easing: options.easing ?? defaultEasing,
            onStart: options.onStart,
            onComplete: () => {
              setIsAnimating(false);
              options.onComplete?.();
              onAnimationComplete?.();
            },
            onCancel: () => {
              setIsAnimating(false);
              options.onCancel?.();
              onAnimationCancel?.();
            },
          }
        );
      } catch (error) {
        setIsAnimating(false);
        console.error('Initialize animation failed:', error);
        onAnimationCancel?.();
      }
    },
    [
      map,
      defaultDuration,
      defaultEasing,
      onAnimationStart,
      onAnimationComplete,
      onAnimationCancel,
    ]
  );

  /**
   * 远距离地址切换（Fly-To 动画）
   */
  const flyTo = useCallback(
    async (options: FlyToOptions): Promise<void> => {
      if (!map || !engineRef.current) {
        console.warn('Map or animation engine is not available');
        return;
      }

      try {
        setIsAnimating(true);
        onAnimationStart?.();

        // TODO: 阶段3实现 - Fly-To 策略的具体逻辑
        // 这里先提供一个占位实现
        const currentConfig = getCurrentCameraConfig();
        const targetConfig: CameraConfig = {
          center: options.target.center,
          zoom: options.target.zoom ?? currentConfig.zoom,
          tilt: currentConfig.tilt,
          heading: currentConfig.heading,
        };

        await engineRef.current.animateCamera(
          map,
          currentConfig,
          targetConfig,
          {
            duration: options.duration ?? defaultDuration,
            easing: options.easing ?? defaultEasing,
            onComplete: () => {
              setIsAnimating(false);
              options.onComplete?.();
              onAnimationComplete?.();
            },
            onCancel: () => {
              setIsAnimating(false);
              options.onCancel?.();
              onAnimationCancel?.();
            },
          }
        );
      } catch (error) {
        setIsAnimating(false);
        console.error('Fly-to animation failed:', error);
        onAnimationCancel?.();
      }
    },
    [
      map,
      defaultDuration,
      defaultEasing,
      getCurrentCameraConfig,
      onAnimationStart,
      onAnimationComplete,
      onAnimationCancel,
    ]
  );

  /**
   * 2D/3D 模式切换
   */
  const switchMode = useCallback(
    async (options: ModeSwitchOptions): Promise<void> => {
      if (!map || !engineRef.current) {
        console.warn('Map or animation engine is not available');
        return;
      }

      try {
        setIsAnimating(true);
        onAnimationStart?.();

        // TODO: 阶段4实现 - 模式切换策略的具体逻辑
        // 这里先提供一个占位实现
        const currentConfig = getCurrentCameraConfig();
        const targetConfig: CameraConfig = {
          center: options.preserveCenter
            ? currentConfig.center
            : currentConfig.center,
          zoom:
            options.targetMode === '3d'
              ? currentConfig.zoom + 1
              : currentConfig.zoom - 1,
          tilt: options.targetMode === '3d' ? 45 : 0,
          heading: 0,
        };

        await engineRef.current.animateCamera(
          map,
          currentConfig,
          targetConfig,
          {
            duration: options.duration ?? defaultDuration,
            easing: options.easing ?? defaultEasing,
            onComplete: () => {
              setIsAnimating(false);
              options.onComplete?.();
              onAnimationComplete?.();
            },
            onCancel: () => {
              setIsAnimating(false);
              options.onCancel?.();
              onAnimationCancel?.();
            },
          }
        );
      } catch (error) {
        setIsAnimating(false);
        console.error('Mode switch animation failed:', error);
        onAnimationCancel?.();
      }
    },
    [
      map,
      defaultDuration,
      defaultEasing,
      getCurrentCameraConfig,
      onAnimationStart,
      onAnimationComplete,
      onAnimationCancel,
    ]
  );

  /**
   * 取消当前动画
   */
  const cancel = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.cancelAll();
      setIsAnimating(false);
      onAnimationCancel?.();
    }
  }, [onAnimationCancel]);

  return {
    initialize,
    flyTo,
    switchMode,
    cancel,
    isAnimating,
  };
}

