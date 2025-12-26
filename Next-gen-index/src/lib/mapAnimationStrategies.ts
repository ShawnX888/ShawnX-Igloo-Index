/**
 * 地图动画策略实现
 * 
 * 包含各种动画策略的具体实现：
 * - InitializeStrategy: 页面初始化动画（高空伪飞入）
 * - FlyToStrategy: 远距离地址切换动画
 * - ModeSwitchStrategy: 2D/3D 模式切换动画
 */

import type {
  AnimationStrategy,
  AnimationOptions,
  CameraConfig,
  InitializeTarget,
  FlyToTarget,
} from '../types/animation';
import {
  MapAnimationEngine,
  SphericalInterpolation,
  adaptiveDuration,
} from './mapAnimationEngine';
import { getAdministrativeRegion } from './regionData';
import type { Region } from '../types';

/**
 * 初始化动画策略
 * 
 * 实现页面初始化时的"高空伪飞入"动画：
 * 从大洲视图（zoom 3-4，tilt 0）平滑过渡到省份视图（zoom 根据省份边界计算，tilt 45）
 */
export class InitializeStrategy implements AnimationStrategy {
  private engine: MapAnimationEngine;

  constructor(engine: MapAnimationEngine) {
    this.engine = engine;
  }

  /**
   * 执行初始化动画
   */
  async animate(
    map: google.maps.Map,
    target: InitializeTarget,
    options: AnimationOptions = {}
  ): Promise<void> {
    // 1. 计算初始状态（大洲视图）
    const continentCenter = this.calculateContinentCenter(target.province.country);
    const continentZoom = this.getContinentZoom(target.province.country);
    const startTilt = 0;

    // 2. 计算目标状态（省份视图）
    const provinceCenter = target.center;
    const provinceZoom = await this.calculateProvinceZoom(
      target.province.country,
      target.province.province
    );
    const targetTilt = 45; // 3D视角

    // 3. 设置初始状态（立即设置，不动画）
    map.moveCamera({
      center: continentCenter,
      zoom: continentZoom,
      tilt: startTilt,
      heading: 0,
    });

    // 4. 等待一帧，确保初始状态已应用
    await new Promise((resolve) => requestAnimationFrame(resolve));

    // 5. 执行动画：从大洲视图切入到省份视图
    const startConfig: CameraConfig = {
      center: continentCenter,
      zoom: continentZoom,
      tilt: startTilt,
      heading: 0,
    };

    const endConfig: CameraConfig = {
      center: provinceCenter,
      zoom: provinceZoom,
      tilt: targetTilt,
      heading: 0,
    };

    await this.engine.animateCamera(map, startConfig, endConfig, {
      duration: options.duration || 2500, // 默认2.5秒
      easing: options.easing,
      onStart: options.onStart,
      onComplete: options.onComplete,
      onCancel: options.onCancel,
    });
  }

  /**
   * 计算大洲中心点（根据国家位置估算）
   */
  private calculateContinentCenter(country: string): google.maps.LatLngLiteral {
    // 根据国家代码返回大洲的大致中心点
    const continentCenters: Record<string, google.maps.LatLngLiteral> = {
      // 亚洲
      CHN: { lat: 35.0, lng: 105.0 }, // 中国 → 亚洲中部
      IDN: { lat: -2.0, lng: 118.0 }, // 印尼 → 东南亚
      MYS: { lat: 4.0, lng: 102.0 }, // 马来西亚 → 东南亚
      THA: { lat: 15.0, lng: 100.0 }, // 泰国 → 东南亚
      VNM: { lat: 16.0, lng: 108.0 }, // 越南 → 东南亚
      SGP: { lat: 1.0, lng: 103.0 }, // 新加坡 → 东南亚
      PHL: { lat: 12.0, lng: 122.0 }, // 菲律宾 → 东南亚
      // 可以添加更多国家
    };

    // 如果找不到精确匹配，使用国家的大致中心点并放大zoom
    return (
      continentCenters[country] || { lat: 20.0, lng: 100.0 }
    ); // 默认：东南亚
  }

  /**
   * 获取大洲级别的zoom
   */
  private getContinentZoom(country: string): number {
    // 根据国家所在大洲返回合适的初始zoom
    const continentZooms: Record<string, number> = {
      CHN: 4, // 中国：亚洲较大，zoom稍大
      IDN: 4, // 印尼：东南亚
      MYS: 5, // 马来西亚：较小国家，zoom稍大
      THA: 5, // 泰国：中等国家
      VNM: 5, // 越南：中等国家
      SGP: 6, // 新加坡：小国家
      PHL: 5, // 菲律宾：中等国家
    };

    return continentZooms[country] || 4; // 默认 zoom 4
  }

  /**
   * 根据省份边界计算合适的 zoom 级别以显示省份全景
   */
  private async calculateProvinceZoom(
    country: string,
    province: string
  ): Promise<number> {
    try {
      // 获取省份边界数据
      const region: Region = { country, province, district: '' };
      const provinceRegion = await getAdministrativeRegion(region);

      if (
        !provinceRegion ||
        !provinceRegion.boundary ||
        provinceRegion.boundary.length === 0
      ) {
        // 如果无法获取边界，使用默认 zoom（根据国家大小调整）
        return this.getDefaultProvinceZoom(country);
      }

      // 计算边界框：遍历所有边界点，找到最小/最大经纬度
      let minLat = Infinity,
        maxLat = -Infinity;
      let minLng = Infinity,
        maxLng = -Infinity;

      for (const point of provinceRegion.boundary) {
        minLat = Math.min(minLat, point.lat);
        maxLat = Math.max(maxLat, point.lat);
        minLng = Math.min(minLng, point.lng);
        maxLng = Math.max(maxLng, point.lng);
      }

      // 计算边界框的宽度和高度（度）
      const latDiff = maxLat - minLat;
      const lngDiff = maxLng - minLng;

      // 使用经验公式：根据边界框大小计算 zoom
      const maxDiff = Math.max(latDiff, lngDiff);

      // 经验公式：根据边界框大小计算 zoom
      // 这个公式需要根据实际测试调整
      if (maxDiff > 10) return 5; // 非常大的省份（如俄罗斯的州）
      if (maxDiff > 5) return 6; // 大省份
      if (maxDiff > 2) return 7; // 中等省份
      if (maxDiff > 1) return 8; // 小省份
      if (maxDiff > 0.5) return 9; // 更小的省份
      return 10; // 默认
    } catch (error) {
      console.error('Failed to calculate province zoom:', error);
      return this.getDefaultProvinceZoom(country);
    }
  }

  /**
   * 根据国家获取默认省份 zoom（降级方案）
   */
  private getDefaultProvinceZoom(country: string): number {
    // 根据国家大小提供合理的默认值
    const countryDefaults: Record<string, number> = {
      CHN: 7, // 中国：省份较大
      USA: 6, // 美国：州较大
      IDN: 8, // 印尼：省份中等
      MYS: 8, // 马来西亚：州中等
      THA: 8, // 泰国：府中等
      VNM: 8, // 越南：省中等
      SGP: 10, // 新加坡：国家很小
      PHL: 8, // 菲律宾：省份中等
    };
    return countryDefaults[country] || 8; // 默认 8
  }
}

/**
 * Fly-To 动画策略
 * 
 * 实现远距离地址切换的抛物线动画：
 * - 标准场景：抛物线动画（先拉高视角，移动位置，再拉近视角）
 * - GPS场景：两阶段动画（先滑动到GPS位置并zoom in，再zoom out到省份全景）
 * - 支持省份全景自动计算
 */
export class FlyToStrategy implements AnimationStrategy {
  private engine: MapAnimationEngine;

  constructor(engine: MapAnimationEngine) {
    this.engine = engine;
  }

  /**
   * 执行 Fly-To 动画
   */
  async animate(
    map: google.maps.Map,
    target: FlyToTarget,
    options: AnimationOptions & { source?: 'region-search' | 'gps-location'; strategy?: 'parabolic' | 'linear' } = {}
  ): Promise<void> {
    const startCenter = map.getCenter();
    if (!startCenter) {
      throw new Error('Map center is not available');
    }

    const startZoom = map.getZoom() ?? 10;

    // 计算目标 zoom
    let targetZoom: number;
    if (target.region) {
      // 根据所选区域（district）边界计算合适的 zoom 以显示区域全景
      targetZoom = await this.calculateRegionZoom(
        target.region.country,
        target.region.province,
        target.region.district
      );
    } else if (target.province) {
      // 降级方案：如果没有区域信息，使用省份边界计算
      targetZoom = await this.calculateProvinceZoom(
        target.province.country,
        target.province.province
      );
    } else {
      targetZoom = target.zoom ?? startZoom;
    }

    // GPS 定位特殊处理：两阶段动画
    if (options.source === 'gps-location') {
      return this.animateGPSSequence(map, target, targetZoom, options);
    }

    // 标准抛物线 Fly-To
    const distance = SphericalInterpolation.calculateDistance(
      startCenter,
      target.center
    );
    const duration = options.duration ?? adaptiveDuration(distance);

    // 计算抛物线最高点（Zoom 最小值）
    const maxZoomOut = Math.min(startZoom, targetZoom) - 2;

    // 使用策略决定动画方式
    if (options.strategy === 'linear') {
      // 线性动画：直接插值
      return this.animateLinear(map, startCenter, target.center, startZoom, targetZoom, duration, options);
    } else {
      // 抛物线动画（默认）
      return this.animateParabolic(map, startCenter, target.center, startZoom, targetZoom, maxZoomOut, duration, options);
    }
  }

  /**
   * 标准抛物线 Fly-To 动画
   */
  private async animateParabolic(
    map: google.maps.Map,
    startCenter: google.maps.LatLng,
    targetCenter: google.maps.LatLng | google.maps.LatLngLiteral,
    startZoom: number,
    targetZoom: number,
    maxZoomOut: number,
    duration: number,
    options: AnimationOptions
  ): Promise<void> {
    const startConfig: CameraConfig = {
      center: startCenter,
      zoom: startZoom,
      tilt: map.getTilt() ?? 0,
      heading: map.getHeading() ?? 0,
    };

    // 使用 Tween.js 实现抛物线动画
    // 注意：我们需要自定义 zoom 曲线，所以不能直接使用 animateCamera
    // 而是手动创建 Tween 来控制 zoom 的抛物线变化

    const startLat = startCenter.lat();
    const startLng = startCenter.lng();
    const targetLat = 'lat' in targetCenter ? targetCenter.lat : targetCenter.lat();
    const targetLng = 'lng' in targetCenter ? targetCenter.lng : targetCenter.lng();

    // 创建 Promise 用于等待动画完成
    let resolvePromise: () => void;
    const animationPromise = new Promise<void>((resolve) => {
      resolvePromise = resolve;
    });

    // 准备插值参数对象
    const params: Record<string, number> = {
      lat: startLat,
      lng: startLng,
      zoom: startZoom,
      progress: 0,
    };

    // 目标参数
    const targetParams: Record<string, number> = {
      lat: targetLat,
      lng: targetLng,
      zoom: targetZoom,
      progress: 1,
    };

    const { Tween, Group } = await import('@tweenjs/tween.js');
    const tweenGroup = new Group();

    // 创建 Tween
    const tween = new Tween(params, tweenGroup)
      .to(targetParams, duration)
      .easing(options.easing || ((t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2))
      .onStart(() => {
        options.onStart?.();
      })
      .onUpdate(() => {
        // 经纬度插值（球面几何）
        const currentCenter = SphericalInterpolation.interpolate(
          { lat: startLat, lng: startLng },
          { lat: targetLat, lng: targetLng },
          params.progress
        );

        // 抛物线 Zoom 曲线
        // 在进度 50% 时达到最大 Zoom Out
        const zoomArc = Math.sin(params.progress * Math.PI) * 2;
        const currentZoom = Math.max(
          maxZoomOut,
          startZoom + (targetZoom - startZoom) * params.progress - zoomArc
        );

        // 原子化更新所有参数
        map.moveCamera({
          center: currentCenter,
          zoom: currentZoom,
        });
      })
      .onComplete(() => {
        options.onComplete?.();
        resolvePromise();
      })
      .onStop(() => {
        options.onCancel?.();
      });

    // 启动 Tween
    tween.start();

    // 启动动画循环
    const animate = (time: number) => {
      tweenGroup.update(time);
      if (tweenGroup.getAll().length > 0) {
        requestAnimationFrame(animate);
      }
    };
    requestAnimationFrame(animate);

    return animationPromise;
  }

  /**
   * 线性 Fly-To 动画
   */
  private async animateLinear(
    map: google.maps.Map,
    startCenter: google.maps.LatLng,
    targetCenter: google.maps.LatLng | google.maps.LatLngLiteral,
    startZoom: number,
    targetZoom: number,
    duration: number,
    options: AnimationOptions
  ): Promise<void> {
    const startConfig: CameraConfig = {
      center: startCenter,
      zoom: startZoom,
      tilt: map.getTilt() ?? 0,
      heading: map.getHeading() ?? 0,
    };

    const endConfig: CameraConfig = {
      center: targetCenter,
      zoom: targetZoom,
      tilt: map.getTilt() ?? 0,
      heading: map.getHeading() ?? 0,
    };

    return this.engine.animateCamera(map, startConfig, endConfig, {
      duration,
      easing: options.easing,
      onStart: options.onStart,
      onComplete: options.onComplete,
      onCancel: options.onCancel,
    });
  }

  /**
   * GPS 定位特殊动画序列
   * 
   * 两阶段动画：
   * 1. 先滑动到GPS定位位置并zoom in到街道级别（15）
   * 2. 再zoom out并移动到所选区域中心，最终显示所选区域全景
   */
  private async animateGPSSequence(
    map: google.maps.Map,
    target: FlyToTarget,
    regionZoom: number,
    options: AnimationOptions
  ): Promise<void> {
    const startCenter = map.getCenter();
    if (!startCenter) {
      throw new Error('Map center is not available');
    }

    const startZoom = map.getZoom() ?? 10;
    const streetZoom = 15; // 街道级别 zoom

    // 获取所选区域中心点（如果提供了区域信息）
    let regionCenter: google.maps.LatLng | google.maps.LatLngLiteral;
    if (target.region) {
      const { getRegionCenter } = await import('./regionData');
      const center = await getRegionCenter(target.region);
      regionCenter = center || target.center;
    } else {
      regionCenter = target.center;
    }

    // 第一阶段：同时滑动到GPS定位位置并zoom in到街道级别
    await this.animateFlyToWithZoom(
      map,
      startCenter,
      target.center,
      startZoom,
      streetZoom,
      1000, // 1秒
      {
        onStart: options.onStart,
        onComplete: undefined, // 第一阶段不触发完成回调
        onCancel: options.onCancel,
      }
    );

    // 短暂停留（增强用户体验，让用户看清GPS定位位置）
    await new Promise((resolve) => setTimeout(resolve, 800));

    // 第二阶段：zoom out并移动到所选区域中心，最终显示所选区域全景
    await this.animateFlyToWithZoom(
      map,
      target.center,
      regionCenter,
      streetZoom,
      regionZoom,
      1200, // 1.2秒
      {
        onStart: undefined,
        onComplete: options.onComplete,
        onCancel: options.onCancel,
      }
    );
  }

  /**
   * 辅助方法：同时进行位置移动和zoom变化
   */
  private async animateFlyToWithZoom(
    map: google.maps.Map,
    startCenter: google.maps.LatLng | google.maps.LatLngLiteral,
    endCenter: google.maps.LatLng | google.maps.LatLngLiteral,
    startZoom: number,
    endZoom: number,
    duration: number,
    options: AnimationOptions
  ): Promise<void> {
    // 处理 startCenter：支持 LatLng 实例和 LatLngLiteral 对象
    const startLat =
      typeof (startCenter as any).lat === 'function'
        ? (startCenter as google.maps.LatLng).lat()
        : (startCenter as google.maps.LatLngLiteral).lat;
    const startLng =
      typeof (startCenter as any).lng === 'function'
        ? (startCenter as google.maps.LatLng).lng()
        : (startCenter as google.maps.LatLngLiteral).lng;
    // 处理 endCenter：支持 LatLng 实例和 LatLngLiteral 对象
    const endLat =
      typeof (endCenter as any).lat === 'function'
        ? (endCenter as google.maps.LatLng).lat()
        : (endCenter as google.maps.LatLngLiteral).lat;
    const endLng =
      typeof (endCenter as any).lng === 'function'
        ? (endCenter as google.maps.LatLng).lng()
        : (endCenter as google.maps.LatLngLiteral).lng;

    // 创建 Promise
    let resolvePromise: () => void;
    const animationPromise = new Promise<void>((resolve) => {
      resolvePromise = resolve;
    });

    // 使用 progress 参数来控制插值
    const params: Record<string, number> = {
      progress: 0,
      zoom: startZoom,
    };

    const targetParams: Record<string, number> = {
      progress: 1,
      zoom: endZoom,
    };

    const { Tween, Group } = await import('@tweenjs/tween.js');
    const tweenGroup = new Group();

    const tween = new Tween(params, tweenGroup)
      .to(targetParams, duration)
      .easing(options.easing || ((t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2))
      .onStart(() => {
        options.onStart?.();
      })
      .onUpdate(() => {
        // 经纬度插值（球面几何）
        const currentCenter = SphericalInterpolation.interpolate(
          { lat: startLat, lng: startLng },
          { lat: endLat, lng: endLng },
          params.progress
        );

        // 原子化更新位置和zoom
        map.moveCamera({
          center: currentCenter,
          zoom: params.zoom,
        });
      })
      .onComplete(() => {
        options.onComplete?.();
        resolvePromise();
      })
      .onStop(() => {
        options.onCancel?.();
      });

    tween.start();

    const animate = (time: number) => {
      tweenGroup.update(time);
      if (tweenGroup.getAll().length > 0) {
        requestAnimationFrame(animate);
      }
    };
    requestAnimationFrame(animate);

    return animationPromise;
  }

  /**
   * 辅助方法：执行 zoom 动画（位置保持不变）
   */
  private async animateZoom(
    map: google.maps.Map,
    center: google.maps.LatLng | google.maps.LatLngLiteral,
    startZoom: number,
    endZoom: number,
    duration: number,
    options: AnimationOptions
  ): Promise<void> {
    const params: Record<string, number> = {
      zoom: startZoom,
    };

    const targetParams: Record<string, number> = {
      zoom: endZoom,
    };

    // 创建 Promise
    let resolvePromise: () => void;
    const animationPromise = new Promise<void>((resolve) => {
      resolvePromise = resolve;
    });

    const { Tween, Group } = await import('@tweenjs/tween.js');
    const tweenGroup = new Group();

    const tween = new Tween(params, tweenGroup)
      .to(targetParams, duration)
      .easing(options.easing || ((t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2))
      .onStart(() => {
        options.onStart?.();
      })
      .onUpdate(() => {
        map.moveCamera({
          center,
          zoom: params.zoom,
        });
      })
      .onComplete(() => {
        options.onComplete?.();
        resolvePromise();
      })
      .onStop(() => {
        options.onCancel?.();
      });

    tween.start();

    const animate = (time: number) => {
      tweenGroup.update(time);
      if (tweenGroup.getAll().length > 0) {
        requestAnimationFrame(animate);
      }
    };
    requestAnimationFrame(animate);

    return animationPromise;
  }

  /**
   * 根据所选区域（district）边界计算合适的 zoom 级别以显示区域全景
   */
  private async calculateRegionZoom(
    country: string,
    province: string,
    district: string
  ): Promise<number> {
    try {
      // 获取区域边界数据
      const region: Region = { country, province, district };
      const regionData = await getAdministrativeRegion(region);

      if (
        !regionData ||
        !regionData.boundary ||
        regionData.boundary.length === 0
      ) {
        // 如果无法获取边界，降级到省份级别计算
        return this.calculateProvinceZoom(country, province);
      }

      // 计算边界框：遍历所有边界点，找到最小/最大经纬度
      let minLat = Infinity,
        maxLat = -Infinity;
      let minLng = Infinity,
        maxLng = -Infinity;

      for (const point of regionData.boundary) {
        minLat = Math.min(minLat, point.lat);
        maxLat = Math.max(maxLat, point.lat);
        minLng = Math.min(minLng, point.lng);
        maxLng = Math.max(maxLng, point.lng);
      }

      // 计算边界框的宽度和高度（度）
      const latDiff = maxLat - minLat;
      const lngDiff = maxLng - minLng;

      // 使用经验公式：根据边界框大小计算 zoom
      const maxDiff = Math.max(latDiff, lngDiff);

      // 经验公式：根据边界框大小计算 zoom（区域级别通常比省份级别更小，zoom 更大）
      if (maxDiff > 2) return 8; // 大区域
      if (maxDiff > 1) return 9; // 中等区域
      if (maxDiff > 0.5) return 10; // 小区域
      if (maxDiff > 0.25) return 11; // 更小的区域
      return 12; // 默认（很小的区域）
    } catch (error) {
      console.error('Failed to calculate region zoom:', error);
      // 降级到省份级别计算
      return this.calculateProvinceZoom(country, province);
    }
  }

  /**
   * 根据省份边界计算合适的 zoom 级别以显示省份全景（降级方案）
   * 
   * 复用 InitializeStrategy 中的逻辑
   */
  private async calculateProvinceZoom(
    country: string,
    province: string
  ): Promise<number> {
    try {
      // 获取省份边界数据
      const region: Region = { country, province, district: '' };
      const provinceRegion = await getAdministrativeRegion(region);

      if (
        !provinceRegion ||
        !provinceRegion.boundary ||
        provinceRegion.boundary.length === 0
      ) {
        // 如果无法获取边界，使用默认 zoom（根据国家大小调整）
        return this.getDefaultProvinceZoom(country);
      }

      // 计算边界框：遍历所有边界点，找到最小/最大经纬度
      let minLat = Infinity,
        maxLat = -Infinity;
      let minLng = Infinity,
        maxLng = -Infinity;

      for (const point of provinceRegion.boundary) {
        minLat = Math.min(minLat, point.lat);
        maxLat = Math.max(maxLat, point.lat);
        minLng = Math.min(minLng, point.lng);
        maxLng = Math.max(maxLng, point.lng);
      }

      // 计算边界框的宽度和高度（度）
      const latDiff = maxLat - minLat;
      const lngDiff = maxLng - minLng;

      // 使用经验公式：根据边界框大小计算 zoom
      const maxDiff = Math.max(latDiff, lngDiff);

      // 经验公式：根据边界框大小计算 zoom
      if (maxDiff > 10) return 5; // 非常大的省份（如俄罗斯的州）
      if (maxDiff > 5) return 6; // 大省份
      if (maxDiff > 2) return 7; // 中等省份
      if (maxDiff > 1) return 8; // 小省份
      if (maxDiff > 0.5) return 9; // 更小的省份
      return 10; // 默认
    } catch (error) {
      console.error('Failed to calculate province zoom:', error);
      return this.getDefaultProvinceZoom(country);
    }
  }

  /**
   * 根据国家获取默认省份 zoom（降级方案）
   */
  private getDefaultProvinceZoom(country: string): number {
    // 根据国家大小提供合理的默认值
    const countryDefaults: Record<string, number> = {
      CHN: 7, // 中国：省份较大
      USA: 6, // 美国：州较大
      IDN: 8, // 印尼：省份中等
      MYS: 8, // 马来西亚：州中等
      THA: 8, // 泰国：府中等
      VNM: 8, // 越南：省中等
      SGP: 10, // 新加坡：国家很小
      PHL: 8, // 菲律宾：省份中等
    };
    return countryDefaults[country] || 8; // 默认 8
  }
}

