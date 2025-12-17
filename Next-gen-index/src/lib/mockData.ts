/**
 * Mock 数据模块
 * 
 * 注意：此文件的静态数据已清空，mock 数据现在在页面加载时动态生成
 * 请使用 weatherDataGenerator.ts 和 rainfallDataGenerator.ts 生成数据
 */

import { RiskData } from "../types/risk";

// Mock 风险数据（用于地图标记图层展示）
// TODO: 实际数据应从风险计算服务获取
// 注意：district 名称需要与 regionCentersRef 中的 key 匹配（GADM 名称格式）
export const initialRiskData: RiskData[] = [
  {
    id: '1',
    region: { country: 'IDN', province: 'Jakarta', district: 'JakartaSelatan' },
    weatherType: 'rainfall',
    value: 150,
    riskLevel: 'high',
    events: 8,
  },
  {
    id: '2',
    region: { country: 'IDN', province: 'Jakarta', district: 'Kota Jakarta Pusat' },
    weatherType: 'rainfall',
    value: 80,
    riskLevel: 'medium',
    events: 4,
  },
  {
    id: '3',
    region: { country: 'IDN', province: 'Jakarta', district: 'JakartaUtara' },
    weatherType: 'rainfall',
    value: 120,
    riskLevel: 'high',
    events: 6,
  },
  {
    id: '4',
    region: { country: 'IDN', province: 'Jakarta', district: 'West Jakarta City' },
    weatherType: 'rainfall',
    value: 60,
    riskLevel: 'low',
    events: 2,
  },
  {
    id: '5',
    region: { country: 'IDN', province: 'Jakarta', district: 'JakartaTimur' },
    weatherType: 'rainfall',
    value: 100,
    riskLevel: 'medium',
    events: 5,
  },
];

export const rainfallHistory: { date: string; amount: number; risk: number }[] = [];

export const rainfallPrediction: { date: string; amount: number; risk: number }[] = [];

export const rainfallHourly: { hour: string; amount: number; risk: number }[] = [];

export const riskEvents: { id: number; date: string; time: string; level: string; type: string; description: string }[] = [];
