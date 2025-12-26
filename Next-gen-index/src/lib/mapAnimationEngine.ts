/**
 * 地图动画引擎核心
 * 
 * 使用 Tween.js 实现平滑的地图动画效果
 * 支持多种动画策略和缓动函数
 */

import { Tween, Group } from '@tweenjs/tween.js';
import type {
  EasingFunction,
  AnimationOptions,
  CameraConfig,
} from '../types/animation';

/**
 * 缓动函数库
 */
export const easings = {
  /** 线性 */
  linear: (t: number) => t,
  /** 缓入缓出（二次） */
  easeInOut: (t: number) =>
    t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
  /** 缓入（二次） */
  easeIn: (t: number) => t * t,
  /** 缓出（二次） */
  easeOut: (t: number) => t * (2 - t),
  /** 缓入缓出（三次） */
  easeInOutCubic: (t: number) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  /** 缓入（三次） */
  easeInCubic: (t: number) => t * t * t,
  /** 缓出（三次） */
  easeOutCubic: (t: number) => 1 - Math.pow(1 - t, 3),
};

/**
 * 动画预设配置
 */
export const animationPresets = {
  /** 快速切换（适合近距离） */
  quick: {
    duration: 500,
    easing: easings.easeOut,
  },
  /** 标准切换（默认） */
  standard: {
    duration: 1500,
    easing: easings.easeInOut,
  },
  /** 平滑切换（适合远距离） */
  smooth: {
    duration: 2500,
    easing: easings.easeInOutCubic,
  },
};

/**
 * 动画引擎类
 * 
 * 负责管理动画生命周期、Tween 实例和 requestAnimationFrame 循环
 */
export class MapAnimationEngine {
  private tweenGroup: Group = new Group();
  private animationFrameId: number | null = null;
  private isRunning = false;

  /**
   * 启动动画循环
   */
  private startAnimationLoop(): void {
    if (this.isRunning) return;

    this.isRunning = true;

    const animate = (time: number) => {
      // 更新所有活动的 Tween
      this.tweenGroup.update(time);

      // 如果还有活动的 Tween，继续循环
      if (this.tweenGroup.getAll().length > 0) {
        this.animationFrameId = requestAnimationFrame(animate);
      } else {
        this.isRunning = false;
        this.animationFrameId = null;
      }
    };

    this.animationFrameId = requestAnimationFrame(animate);
  }

  /**
   * 创建并执行相机动画
   * 
   * @param map 地图实例
   * @param startConfig 起始相机配置
   * @param endConfig 目标相机配置
   * @param options 动画选项
   * @returns Promise，动画完成时解析
   */
  async animateCamera(
    map: google.maps.Map,
    startConfig: CameraConfig,
    endConfig: CameraConfig,
    options: AnimationOptions = {}
  ): Promise<void> {
    const {
      duration = animationPresets.standard.duration,
      easing = animationPresets.standard.easing,
      onStart,
      onComplete,
      onCancel,
    } = options;

    // 准备插值参数对象
    const startLat =
      'lat' in startConfig.center
        ? startConfig.center.lat
        : startConfig.center.lat();
    const startLng =
      'lng' in startConfig.center
        ? startConfig.center.lng
        : startConfig.center.lng();

    const params: Record<string, number> = {
      lat: startLat,
      lng: startLng,
      zoom: startConfig.zoom,
      tilt: startConfig.tilt ?? 0,
      heading: startConfig.heading ?? 0,
    };

    // 目标参数
    const targetParams: Record<string, number> = {
      lat:
        'lat' in endConfig.center
          ? endConfig.center.lat
          : endConfig.center.lat(),
      lng:
        'lng' in endConfig.center
          ? endConfig.center.lng
          : endConfig.center.lng(),
      zoom: endConfig.zoom,
      tilt: endConfig.tilt ?? 0,
      heading: endConfig.heading ?? 0,
    };

    // 创建 Tween
    const tween = new Tween(params, this.tweenGroup)
      .to(targetParams, duration)
      .easing(easing)
      .onStart(() => {
        onStart?.();
      })
      .onUpdate(() => {
        // 原子化更新所有相机参数
        map.moveCamera({
          center: { lat: params.lat, lng: params.lng },
          zoom: params.zoom,
          tilt: params.tilt,
          heading: params.heading,
        });
      })
      .onComplete(() => {
        onComplete?.();
      })
      .onStop(() => {
        onCancel?.();
      });

    // 启动 Tween
    tween.start();

    // 启动动画循环（如果尚未运行）
    this.startAnimationLoop();

    // 等待动画完成
    return new Promise((resolve) => {
      tween.onComplete(() => {
        resolve();
      });
    });
  }

  /**
   * 取消所有动画
   */
  cancelAll(): void {
    this.tweenGroup.getAll().forEach((tween) => {
      tween.stop();
    });
    this.tweenGroup.removeAll();

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.isRunning = false;
  }

  /**
   * 检查是否有动画正在进行
   */
  isAnimating(): boolean {
    return this.tweenGroup.getAll().length > 0;
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.cancelAll();
  }
}

/**
 * 球面几何插值工具
 */
export class SphericalInterpolation {
  /**
   * 在球面上插值两个经纬度点
   * 
   * @param start 起始点
   * @param end 结束点
   * @param t 插值参数（0-1）
   * @returns 插值后的经纬度
   */
  static interpolate(
    start: google.maps.LatLng | google.maps.LatLngLiteral,
    end: google.maps.LatLng | google.maps.LatLngLiteral,
    t: number
  ): google.maps.LatLngLiteral {
    const startLat =
      'lat' in start ? start.lat : start.lat();
    const startLng =
      'lng' in start ? start.lng : start.lng();
    const endLat = 'lat' in end ? end.lat : end.lat();
    const endLng = 'lng' in end ? end.lng : end.lng();

    // 对于短距离，使用线性插值即可
    // 对于长距离，可以使用更复杂的球面插值算法
    // 这里先使用线性插值，后续可以优化为使用 Google Maps Geometry 库
    return {
      lat: startLat + (endLat - startLat) * t,
      lng: startLng + (endLng - startLng) * t,
    };
  }

  /**
   * 计算两个经纬度点之间的距离（公里）
   * 
   * @param start 起始点
   * @param end 结束点
   * @returns 距离（公里）
   */
  static calculateDistance(
    start: google.maps.LatLng | google.maps.LatLngLiteral,
    end: google.maps.LatLng | google.maps.LatLngLiteral
  ): number {
    const startLat =
      'lat' in start ? start.lat : start.lat();
    const startLng =
      'lng' in start ? start.lng : start.lng();
    const endLat = 'lat' in end ? end.lat : end.lat();
    const endLng = 'lng' in end ? end.lng : end.lng();

    const R = 6371; // 地球半径（公里）
    const dLat = ((endLat - startLat) * Math.PI) / 180;
    const dLng = ((endLng - startLng) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((startLat * Math.PI) / 180) *
        Math.cos((endLat * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}

/**
 * 根据距离自适应计算动画时长
 * 
 * @param distance 距离（公里）
 * @returns 动画时长（毫秒）
 */
export function adaptiveDuration(distance: number): number {
  const baseDuration = 1000; // 1秒基础时长
  const distanceFactor = Math.min(distance / 1000, 5); // 每1000km增加，最多5倍
  return baseDuration * (1 + distanceFactor);
}

