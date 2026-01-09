/**
 * 保险产品配置文件
 * 包含三种产品的完整定义：降雨量日内产品、降雨量周度产品、降雨量月度产品
 * 
 * 根据需求文档 #4.3.2 产品级风险事件触发条件：
 * - 降雨量日内产品：4小时累计降雨量 > 阈值（100mm tier1, 120mm tier2, 140mm tier3），时间区间：00:00 to 23:59
 * - 降雨量周度产品：7天累计降雨量 > 阈值（300mm tier1, 350mm tier2, 400mm tier3）
 * - 降雨量月度产品：当月累计降雨量 < 阈值（60mm tier1, 40mm tier2, 20mm tier3）
 * 
 * 注意：
 * - riskRules：产品级的风险事件触发条件，用于风险计算引擎计算风险事件
 * - payoutRules：保单级的赔付原则，仅用于产品介绍页的教育展示，不参与计算
 */

import type { ProductLibraryConfig } from '../types/product';

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
      description: '4-hour cumulative rainfall within one day (00:00 to 23:59) > threshold, once per day per policy',
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
          { value: 100, level: 'tier1', label: '100mm' },
          { value: 120, level: 'tier2', label: '120mm' },
          { value: 140, level: 'tier3', label: '140mm' }
        ],
        calculation: {
          aggregation: 'sum',
          operator: '>',
          unit: 'mm'
        }
      },
      payoutRules: {
        frequencyLimit: 'once per day per policy',
        payoutPercentages: {
          tier1: 20,
          tier2: 50,
          tier3: 100
        }
      }
    },
    {
      id: 'weekly',
      name: 'Weekly Accumulation Rainfall',
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
          { value: 300, level: 'tier1', label: '300mm' },
          { value: 350, level: 'tier2', label: '350mm' },
          { value: 400, level: 'tier3', label: '400mm' }
        ],
        calculation: {
          aggregation: 'sum',
          operator: '>',
          unit: 'mm'
        }
      },
      payoutRules: {
        frequencyLimit: 'once per month per policy',
        payoutPercentages: {
          tier1: 20,
          tier2: 50,
          tier3: 100
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
          size: 1 // 1个月（完整自然月，固定窗口，无需step）
        },
        thresholds: [
          { value: 60, level: 'tier1', label: '60mm' },
          { value: 40, level: 'tier2', label: '40mm' },
          { value: 20, level: 'tier3', label: '20mm' }
        ],
        calculation: {
          aggregation: 'sum',
          operator: '<', // 注意：月度产品是小于阈值
          unit: 'mm'
        }
      },
      payoutRules: {
        payoutPercentages: {
          tier1: 20,
          tier2: 50,
          tier3: 100
        }
      }
    }
  ]
};

