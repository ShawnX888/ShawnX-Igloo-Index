/**
 * Mock 数据模块
 * 
 * 注意：此文件的静态数据已清空，mock 数据现在在页面加载时动态生成
 * 请使用 weatherDataGenerator.ts 和 rainfallDataGenerator.ts 生成数据
 */

import { RiskData } from "../types/risk";

// 空数据，实际数据在运行时根据选择的区域动态生成
export const initialRiskData: RiskData[] = [];

export const rainfallHistory: { date: string; amount: number; risk: number }[] = [];

export const rainfallPrediction: { date: string; amount: number; risk: number }[] = [];

export const rainfallHourly: { hour: string; amount: number; risk: number }[] = [];

export const riskEvents: { id: number; date: string; time: string; level: string; type: string; description: string }[] = [];
