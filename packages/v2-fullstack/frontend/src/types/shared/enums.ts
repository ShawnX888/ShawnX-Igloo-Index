/**
 * Shared Enumerations - v2 Shared Contract
 * 
 * 这些枚举类型必须与后端 Pydantic Schema 保持严格一致
 */

/**
 * 数据类型
 * 
 * historical - 历史数据（不可变）
 * predicted  - 预测数据（易变，需批次管理）
 */
export enum DataType {
  Historical = 'historical',
  Predicted = 'predicted'
}

/**
 * 天气类型
 * 
 * rainfall     - 降雨
 * wind         - 风
 * temperature  - 温度
 * humidity     - 湿度
 * pressure     - 气压
 */
export enum WeatherType {
  Rainfall = 'rainfall',
  Wind = 'wind',
  Temperature = 'temperature',
  Humidity = 'humidity',
  Pressure = 'pressure'
}

/**
 * 访问模式（Access Mode）
 * 
 * demo     - Demo/Public（路演默认，数据脱敏）
 * partner  - Partner（合作伙伴，部分脱敏）
 * admin    - Admin/Internal（内部，全量数据）
 */
export enum AccessMode {
  Demo = 'demo',
  Partner = 'partner',
  Admin = 'admin'
}

/**
 * 区域层级（Region Scope）
 * 
 * province - 省级
 * district - 区/县级
 */
export enum RegionScope {
  Province = 'province',
  District = 'district'
}

/**
 * 数据粒度（Granularity）
 * 
 * hourly  - 小时级
 * daily   - 日级
 * weekly  - 周级
 * monthly - 月级
 */
export enum Granularity {
  Hourly = 'hourly',
  Daily = 'daily',
  Weekly = 'weekly',
  Monthly = 'monthly'
}

/**
 * 风险等级（Tier Level）
 * 
 * tier1 - 一级风险
 * tier2 - 二级风险
 * tier3 - 三级风险
 */
export enum TierLevel {
  Tier1 = 'tier1',
  Tier2 = 'tier2',
  Tier3 = 'tier3'
}

/**
 * 类型守卫工具函数
 */
export function isDataType(value: unknown): value is DataType {
  return Object.values(DataType).includes(value as DataType);
}

export function isWeatherType(value: unknown): value is WeatherType {
  return Object.values(WeatherType).includes(value as WeatherType);
}

export function isAccessMode(value: unknown): value is AccessMode {
  return Object.values(AccessMode).includes(value as AccessMode);
}

export function isRegionScope(value: unknown): value is RegionScope {
  return Object.values(RegionScope).includes(value as RegionScope);
}

export function isGranularity(value: unknown): value is Granularity {
  return Object.values(Granularity).includes(value as Granularity);
}

export function isTierLevel(value: unknown): value is TierLevel {
  return Object.values(TierLevel).includes(value as TierLevel);
}
