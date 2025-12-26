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
} from '../types/animation';
import { MapAnimationEngine, SphericalInterpolation } from './mapAnimationEngine';
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

