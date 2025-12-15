# 接口定义说明

## 目录结构

```
src/interfaces/
├── dataGenerator.ts    # 数据生成器接口
├── productLibrary.ts   # 产品库接口
├── riskCalculation.ts  # 风险计算引擎接口
├── mapService.ts       # 地图服务接口
└── index.ts           # 统一导出
```

## 使用方式

### 导入接口

```typescript
// 从统一入口导入
import { RainfallDataGenerator, ProductLibrary, RiskCalculationEngine } from '@/interfaces';

// 或从具体文件导入
import { RainfallDataGenerator } from '@/interfaces/dataGenerator';
```

### 接口说明

- **RainfallDataGenerator**: 降雨量数据生成器接口
- **ProductLibrary**: 产品库接口
- **RiskCalculationEngine**: 风险计算引擎接口
- **MapService**: 地图服务接口

## 实现说明

- 接口定义遵循 SOLID 原则
- 每个接口职责单一，便于实现和测试
- 接口支持依赖注入，便于扩展和维护

