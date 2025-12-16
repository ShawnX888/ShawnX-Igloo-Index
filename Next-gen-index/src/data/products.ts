/**
 * 保险产品配置文件
 * 包含三种产品类型的完整定义：日内、周度、月度
 * 
 * 根据需求文档：
 * - 日内产品：4小时累计降雨量 > 阈值（100mm, 120mm, 140mm），每天最多触发一次
 * - 周度产品：7天累计降雨量 > 阈值（300mm, 350mm, 400mm），每月最多触发一次
 * - 月度产品：当月累计降雨量 < 阈值（60mm, 40mm, 20mm），每月最多触发一次
 */

import { Product, ProductLibraryConfig } from '../types/product';

/**
 * 产品库配置
 */
export const PRODUCT_LIBRARY_CONFIG: ProductLibraryConfig = {
  version: '1.0.0',
  products: [
    {
      id: 'daily',
      name: 'Daily Heavy Rain',
      type: 'daily',
      weatherType: 'rainfall',
      description: '4-hour cumulative rainfall within one day (00:00 to 23:00) > threshold, once per day per policy',
      icon: '🌧️',
      riskRules: {
        triggerType: 'daily',
        weatherType: 'rainfall',
        timeWindow: {
          type: 'hourly',
          size: 4, // 4小时滑动窗口
          step: 1 // 每小时滑动一次
        },
        thresholds: [
          { value: 100, level: 'low', label: '100mm' },
          { value: 120, level: 'medium', label: '120mm' },
          { value: 140, level: 'high', label: '140mm' }
        ],
        calculation: {
          aggregation: 'sum',
          operator: '>',
          unit: 'mm'
        }
      }
    },
    {
      id: 'weekly',
      name: 'Weekly Accumulation',
      type: 'weekly',
      weatherType: 'rainfall',
      description: '7-day cumulative rainfall within one month > threshold, once per month per policy',
      icon: '📅',
      riskRules: {
        triggerType: 'weekly',
        weatherType: 'rainfall',
        timeWindow: {
          type: 'daily',
          size: 7, // 7天滑动窗口
          step: 1 // 每天滑动一次
        },
        thresholds: [
          { value: 300, level: 'low', label: '300mm' },
          { value: 350, level: 'medium', label: '350mm' },
          { value: 400, level: 'high', label: '400mm' }
        ],
        calculation: {
          aggregation: 'sum',
          operator: '>',
          unit: 'mm'
        }
      }
    },
    {
      id: 'drought',
      name: 'Drought Defense',
      type: 'monthly',
      weatherType: 'rainfall',
      description: 'Cumulative rainfall of one month < threshold',
      icon: '☀️',
      riskRules: {
        triggerType: 'monthly',
        weatherType: 'rainfall',
        timeWindow: {
          type: 'monthly',
          size: 1, // 1个月（完整自然月）
          step: 1
        },
        thresholds: [
          { value: 60, level: 'low', label: '60mm' },
          { value: 40, level: 'medium', label: '40mm' },
          { value: 20, level: 'high', label: '20mm' }
        ],
        calculation: {
          aggregation: 'sum',
          operator: '<', // 注意：月度产品是小于阈值
          unit: 'mm'
        }
      }
    }
  ]
};

