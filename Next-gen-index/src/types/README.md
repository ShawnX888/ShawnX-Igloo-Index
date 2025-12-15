# 类型定义说明

## 目录结构

```
src/types/
├── region.ts          # 区域相关类型
├── data.ts            # 数据相关类型
├── product.ts         # 产品相关类型
├── risk.ts            # 风险相关类型
├── map.ts             # 地图相关类型
├── common.ts          # 通用类型
└── index.ts           # 统一导出
```

## 使用方式

### 导入类型

```typescript
// 从统一入口导入
import { Region, RainfallType, Product, RiskEvent } from '@/types';

// 或从具体文件导入
import { Region, AdministrativeRegion } from '@/types/region';
```

### 类型说明

- **Region**: 基础区域信息（国家、省/州、市/区）
- **AdministrativeRegion**: 包含地理信息的行政区域
- **RainfallData**: 降雨量数据
- **Product**: 保险产品定义
- **RiskEvent**: 风险事件
- **RiskStatistics**: 风险统计数据
- **DateRange**: 时间范围
- **MapConfig**: 地图配置

## 扩展说明

- 所有类型定义都支持未来扩展
- 新增类型时，请在对应的文件中添加，并在 `index.ts` 中导出
- 保持类型定义的向后兼容性

