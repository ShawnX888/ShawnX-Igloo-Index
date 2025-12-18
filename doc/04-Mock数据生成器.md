# 04-Mock数据生成器

## 步骤概述

### 步骤编号和名称
**步骤04**：Mock数据生成器

### 步骤目标
实现Mock天气数据生成器，能够根据用户选择的区域和时间范围，实时生成或补充天气数据，并实现数据缓存机制以优化性能。

### 预期成果
- 可以根据区域和时间范围生成Mock天气数据
- 数据格式统一，包含小时级和日级数据
- 数据缓存机制正常工作，避免重复生成
- 数据生成性能满足要求（2秒内）

---

## 当前状态

### 重要说明
**静态 Mock 数据已清空**。`src/lib/mockData.ts` 中的静态数据已被移除，改为在运行时根据选择的区域动态生成。

请使用以下生成器：
- `src/lib/weatherDataGenerator.ts` - 通用天气数据生成器
- `src/lib/rainfallDataGenerator.ts` - 降雨量数据生成器

---

## 前置条件

### 依赖的步骤
- **步骤05**：行政区域数据管理（获取区域列表）

### 需要完成的前置工作
- 区域数据结构已定义
- 区域层级关系已准备（Google 名称格式）

### 需要的数据/接口
- 区域信息：`Region` 类型（country, province, district）
- 时间范围：`DateRange` 类型（from, to, startHour, endHour）
- 数据类型：`DataType`（"historical" | "predicted"）
- 天气类型：`WeatherType`（"rainfall" | "temperature" | "wind" | "humidity" | "pressure" | "snowfall"）

---

## 实现要点

### 核心功能点

1. **动态数据生成**
   - 根据当前选择的区域动态生成数据
   - 使用区域名称（Google 名称）作为数据种子
   - 确保同一区域同一时间的数据一致

2. **数据生成逻辑**
   - 根据区域生成唯一的数据种子（确保同一区域数据一致）
   - 根据时间范围生成小时级和日级数据
   - 历史数据和预测数据使用不同的生成策略

3. **数据缓存机制**
   - 使用 `useMemo` 缓存已生成的数据
   - 缓存 key 基于：区域、时间范围、数据类型
   - 如果数据已存在且完整，直接返回缓存

4. **数据格式定义**
   - 小时级数据：每个"市/区"每小时一个降雨量值（mm）
   - 日级数据：每个"市/区"每天一个降雨量累计值（mm）
   - 数据应包含：日期、降雨量、风险级别

### 技术实现方案

#### 1. 数据生成策略
- **历史数据**：使用确定性算法生成，确保同一区域同一时间的数据一致
- **预测数据**：可以有一定的随机性，但保持区域特征
- **区域差异**：不同区域应该有明显的数据差异，体现区域特征

#### 2. 缓存机制
```typescript
const allRegionsData = useMemo(() => {
  // 1. 检查缓存
  // 2. 如果存在且完整，直接返回
  // 3. 如果部分缺失，只补充缺失部分
  // 4. 如果完全缺失，生成新数据
  return data;
}, [selectedRegion, dateRange, dataType]);
```

#### 3. 数据格式
```typescript
// 通用天气数据格式
interface WeatherData {
  date: string; // ISO格式
  value: number; // 数值（根据天气类型有不同的单位和含义）
  risk?: 'low' | 'medium' | 'high';
  weatherType?: WeatherType;
}

interface RegionWeatherData {
  [districtName: string]: WeatherData[];
}

// 降雨量数据格式（向后兼容）
interface RainfallData {
  date: string; // ISO格式
  amount: number; // 降雨量 (mm)
  risk?: 'low' | 'medium' | 'high';
}

interface RegionData {
  [districtName: string]: RainfallData[];
}
```

### 关键代码结构

#### 静态数据（已清空）
```typescript
// src/lib/mockData.ts
// 静态数据已清空，实际数据在运行时动态生成
export const initialRiskData: RiskData[] = [];
export const rainfallHistory: { date: string; amount: number; risk: number }[] = [];
export const rainfallPrediction: { date: string; amount: number; risk: number }[] = [];
export const rainfallHourly: { hour: string; amount: number; risk: number }[] = [];
export const riskEvents: { id: number; date: string; time: string; level: string; type: string; description: string }[] = [];
```

#### 数据生成函数
```typescript
// 通用天气数据生成函数
function generateWeatherData(
  region: Region,
  dateRange: DateRange,
  dataType: DataType,
  weatherType: WeatherType
): RegionWeatherData {
  // 1. 根据区域和天气类型获取区域种子
  // 2. 根据天气类型选择生成配置
  // 3. 生成时间序列
  // 4. 为每个区域生成数据
  // 5. 返回格式化的数据
}
```

#### 缓存Hook
```typescript
// 通用天气数据Hook
function useWeatherData(
  selectedRegion: Region,
  dateRange: DateRange,
  dataType: DataType,
  weatherType: WeatherType
) {
  return useMemo(() => {
    // 生成或获取缓存数据
  }, [selectedRegion, dateRange, dataType, weatherType]);
}
```

---

## 输入输出

### 输入
- **区域信息**：`Region`（country, province, district）- 使用 Google 名称
- **时间范围**：`DateRange`（from, to, startHour, endHour）
- **数据类型**：`DataType`（"historical" | "predicted"）
- **天气类型**：`WeatherType`

### 输出
- **区域天气数据**：`RegionWeatherData` 类型，包含所有"市/区"的天气数据

---

## 验收标准

### 功能验收标准
- [x] 可以根据区域和时间范围正确生成数据
- [x] 同一区域同一时间的数据保持一致
- [x] 不同区域的数据有明显差异
- [x] 数据缓存机制正常工作

### 性能验收标准
- [x] 数据生成/补充应在 2 秒内完成
- [x] 缓存命中时，数据获取应在 100ms 内完成

### 数据质量验收标准
- [x] 数据格式统一，符合接口定义
- [x] 数据值合理

---

## 相关文件

| 文件路径 | 说明 |
|----------|------|
| `src/lib/mockData.ts` | 静态数据定义（已清空） |
| `src/lib/weatherDataGenerator.ts` | 通用天气数据生成器 |
| `src/lib/rainfallDataGenerator.ts` | 降雨量数据生成器 |

---

## 注意事项

### 重要变更
- **静态 Mock 数据已清空**：所有静态数据已被移除
- **动态生成**：数据在页面加载时根据选择的区域动态生成
- **区域名称**：使用 Google 名称格式，与 UI 下拉选项一致

### 技术难点
- **确定性数据生成**：确保同一区域同一时间的数据一致
- **增量数据生成**：只生成缺失的时间段

### 扩展性考虑
- 支持多种天气类型
- 预留真实 API 接口
- 配置化生成参数

---

## 下一步

### 后续步骤的准备工作
- 数据生成器已实现，可以在步骤12中使用数据渲染热力图
- 数据格式已统一，可以在步骤07中使用数据进行风险计算

### 数据/接口的传递
- 数据通过 `useMemo` 返回，传递给 `MapWorkspace` 和 `DataDashboard`

---

**文档版本**：v2.0  
**创建日期**：2025-01-27  
**最后更新**：2025-12-17
