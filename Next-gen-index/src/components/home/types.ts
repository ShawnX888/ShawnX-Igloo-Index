/**
 * 类型定义 - 从统一类型系统导入
 * 为了保持向后兼容，这里重新导出类型
 */

// 从统一类型系统导入
export type { Region, DateRange, DataType, WeatherType, WeatherData, RegionWeatherData, WeatherStatistics } from '../../types';
export type { RiskEvent, RiskStatistics } from '../../types';

// 向后兼容：RainfallType 作为 DataType 的别名
export type { RainfallType } from '../../types';

// InsuranceProduct 类型（向后兼容的简化版本）
// 注意：这是现有代码使用的简化版本，完整的 Product 类型在 types/product.ts 中定义
export interface InsuranceProduct {
  id: string;
  name: string;
  description: string;
  icon: string;
}

// RiskData 类型从统一类型系统导入（支持多种天气类型）
export type { RiskData } from '../../types/risk';
