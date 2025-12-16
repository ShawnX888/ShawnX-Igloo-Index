# 04-Mock数据生成器

## 步骤概述

### 步骤编号和名称
**步骤04**：Mock数据生成器

### 步骤目标
实现Mock降雨量数据生成器，能够根据用户选择的区域和时间范围，实时生成或补充降雨量数据，并实现数据缓存机制以优化性能。

### 预期成果
- 可以根据区域和时间范围生成Mock降雨量数据
- 数据格式统一，包含小时级和日级数据
- 数据缓存机制正常工作，避免重复生成
- 数据生成性能满足要求（2秒内）

---

## 前置条件

### 依赖的步骤
- 无（数据生成器相对独立）

### 需要完成的前置工作
- 了解现有`lib/mockData.ts`的结构
- 确认数据格式需求（小时级、日级）

### 需要的数据/接口
- 区域信息：`Region`类型（country, province, district）
- 时间范围：`DateRange`类型（from, to, startHour, endHour）
- 数据类型：`DataType`（"historical" | "predicted"）
- 天气类型：`WeatherType`（"rainfall" | "temperature" | "wind" | "humidity" | "pressure" | "snowfall"）

---

## 实现要点

### 核心功能点

1. **数据生成逻辑**
   - 根据区域生成唯一的数据种子（确保同一区域数据一致）
   - 根据时间范围生成小时级和日级数据
   - 历史数据和预测数据使用不同的生成策略
   - 数据应该有一定的随机性，但保持区域和时间的一致性

2. **数据缓存机制**
   - 使用`useMemo`缓存已生成的数据
   - 缓存key基于：区域、时间范围、数据类型
   - 如果数据已存在且完整，直接返回缓存
   - 如果数据部分缺失，只补充缺失部分

3. **数据格式定义**
   - 小时级数据：每个"市/区"每小时一个降雨量值（mm）
   - 日级数据：每个"市/区"每天一个降雨量累计值（mm）
   - 数据应包含：日期、降雨量、风险级别（可选）

4. **数据生成范围**
   - 时间范围：过去40天至未来10天
   - 空间范围：选择的"市/区"所属的"省/州"下所有的"市/区"
   - 数据粒度：小时级数据和日级数据

### 技术实现方案

#### 1. 数据生成策略
- **历史数据**：使用确定性算法生成，确保同一区域同一时间的数据一致
- **预测数据**：可以有一定的随机性，但保持区域特征
- **区域差异**：不同区域应该有明显的数据差异，体现区域特征

#### 2. 缓存机制
```typescript
// 伪代码示例
const allRegionsData = useMemo(() => {
  // 1. 检查缓存
  // 2. 如果存在且完整，直接返回
  // 3. 如果部分缺失，只补充缺失部分
  // 4. 如果完全缺失，生成新数据
  return data;
}, [selectedRegion, dateRange, rainfallType]);
```

#### 3. 数据格式
```typescript
// 通用天气数据格式（推荐使用）
interface WeatherData {
  date: string; // ISO格式
  value: number; // 数值（根据天气类型有不同的单位和含义）
  risk?: 'low' | 'medium' | 'high';
  weatherType?: WeatherType; // 天气类型标识
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

#### 数据生成函数
```typescript
// 通用天气数据生成函数（推荐使用）
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

// 降雨量数据生成函数（向后兼容）
function generateRainfallData(
  region: Region,
  dateRange: DateRange,
  type: DataType
): RegionData {
  // 内部调用 generateWeatherData(region, dateRange, type, 'rainfall')
  // 并转换为 RainfallData 格式
}
```

#### 缓存Hook
```typescript
// 通用天气数据Hook（推荐使用）
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

// 降雨量数据Hook（向后兼容）
function useRainfallData(
  selectedRegion: Region,
  dateRange: DateRange,
  rainfallType: DataType
) {
  // 内部调用 useWeatherData(selectedRegion, dateRange, rainfallType, 'rainfall')
  // 并转换为 RainfallData 格式
}
```

---

## 输入输出

### 输入
- **区域信息**：`Region`（country, province, district）
- **时间范围**：`DateRange`（from, to, startHour, endHour）
- **数据类型**：`DataType`（"historical" | "predicted"）
- **天气类型**：`WeatherType`（"rainfall" | "temperature" | "wind" | "humidity" | "pressure" | "snowfall"）

### 输出
- **区域天气数据**：`RegionWeatherData`类型，包含所有"市/区"的天气数据
  - 每个区域的数据格式：`WeatherData[]`
  - 数据包含：日期、数值、风险级别、天气类型
- **区域降雨量数据**（向后兼容）：`RegionData`类型，包含所有"市/区"的降雨量数据
  - 每个区域的数据格式：`RainfallData[]`
  - 数据包含：日期、降雨量、风险级别

---

## 验收标准

### 功能验收标准
- [ ] 可以根据区域和时间范围正确生成数据
- [ ] 生成的数据包含小时级和日级数据
- [ ] 同一区域同一时间的数据保持一致（确定性）
- [ ] 不同区域的数据有明显差异
- [ ] 历史数据和预测数据使用不同的生成策略
- [ ] 数据缓存机制正常工作，避免重复生成

### 性能验收标准
- [ ] 数据生成/补充应在2秒内完成
- [ ] 缓存命中时，数据获取应在100ms内完成
- [ ] 内存使用合理，不会导致内存泄漏

### 数据质量验收标准
- [ ] 数据格式统一，符合接口定义
- [ ] 数据范围正确（过去40天至未来10天）
- [ ] 数据值合理（降雨量在合理范围内）
- [ ] 数据包含必要的字段（日期、降雨量）

---

## 注意事项

### 常见问题
1. **数据生成不一致**
   - 确保使用确定性算法（基于区域种子）
   - 确保时间范围计算正确

2. **缓存失效**
   - 确保缓存key包含所有相关参数
   - 确保参数变化时缓存正确更新

3. **性能问题**
   - 避免生成过多不必要的数据
   - 使用增量生成，只生成缺失部分

### 技术难点
- **确定性数据生成**：确保同一区域同一时间的数据一致，同时保持随机性
- **增量数据生成**：只生成缺失的时间段，避免重复计算
- **数据格式统一**：确保生成的数据格式与后续步骤兼容

### 扩展性考虑

#### 1. 多天气类型支持
- **设计目标**：支持多种天气数据类型（降雨量、温度、风速、湿度、气压、降雪等）
- **实现方式**：
  - 使用 `WeatherType` 类型定义支持的天气类型：`'rainfall' | 'temperature' | 'wind' | 'humidity' | 'pressure' | 'snowfall'`
  - 使用通用的 `WeatherData` 接口替代 `RainfallData`，通过 `weatherType` 字段区分数据类型
  - 使用 `WeatherDataGenerator` 接口，支持通过 `weatherType` 参数生成不同类型的天气数据
  - 每种天气类型有独立的生成配置（基础值范围、时间因子、季节性因子等）

#### 2. 数据生成器架构
- **通用生成器**：`MockWeatherDataGenerator` 实现 `WeatherDataGenerator` 接口，支持所有天气类型
- **向后兼容**：`MockRainfallDataGenerator` 作为适配器，内部使用 `WeatherDataGenerator`，保持现有代码兼容
- **配置化**：每种天气类型的生成参数通过 `WEATHER_CONFIGS` 配置对象管理，便于扩展新类型

#### 3. 类型系统扩展
- **数据类型**：使用 `DataType`（'historical' | 'predicted'）替代 `RainfallType`，更通用
- **数据接口**：`WeatherData` 接口包含 `value`（通用数值）和 `weatherType`（类型标识）
- **区域数据**：`RegionWeatherData` 替代 `RegionData`，支持多种天气类型

#### 4. 未来扩展方向
- 数据生成逻辑可以提取为独立函数，便于测试
- 数据生成策略可以配置化，便于未来调整
- 预留真实API接口，便于未来替换为真实数据
- 支持自定义天气类型和生成配置
- 支持多天气类型组合查询（如同时查询降雨量和温度）

---

## 下一步

### 后续步骤的准备工作
- 数据生成器已实现，可以在步骤12中使用数据渲染热力图
- 数据格式已统一，可以在步骤07中使用数据进行风险计算

### 数据/接口的传递
- 数据通过`useMemo`返回，传递给`MapWorkspace`和`DataDashboard`
- 数据格式与`Dashboard`组件中的`allRegionsData`兼容

---

**文档版本**：v1.0  
**创建日期**：2025-01-27  
**最后更新**：2025-01-27
