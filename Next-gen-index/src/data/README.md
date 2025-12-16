# 数据文件说明

## 文件结构

- `regions.ts`: 包含所有国家的行政区域层级数据和坐标数据
- `products.ts`: 包含所有保险产品的配置数据

## 区域数据 (regions.ts)

### REGION_HIERARCHY
三级层级结构：`国家 -> 省/州 -> 市/区`

### REGION_CENTERS
区域中心点坐标数据，用于地图定位和边界生成

详细说明请参考 `regions.ts` 文件注释。

## 产品数据 (products.ts)

### PRODUCT_LIBRARY_CONFIG
产品库配置，包含所有保险产品的定义。

### 产品类型

1. **日内产品 (daily)**
   - ID: `daily`
   - 触发条件：4小时累计降雨量 > 阈值
   - 阈值：100mm (low), 120mm (medium), 140mm (high)
   - 时间窗口：4小时滑动窗口

2. **周度产品 (weekly)**
   - ID: `weekly`
   - 触发条件：7天累计降雨量 > 阈值
   - 阈值：300mm (low), 350mm (medium), 400mm (high)
   - 时间窗口：7天滑动窗口

3. **月度产品 (monthly/drought)**
   - ID: `drought`
   - 触发条件：当月累计降雨量 < 阈值
   - 阈值：60mm (low), 40mm (medium), 20mm (high)
   - 时间窗口：完整自然月

## 使用方法

### 使用产品库

```typescript
import { productLibrary } from '@/lib/productLibrary';

// 获取所有产品
const allProducts = productLibrary.getAllProducts();

// 根据ID获取产品
const dailyProduct = productLibrary.getProduct('daily');

// 根据类型获取产品
const dailyProducts = productLibrary.getProductsByType('daily');
```

### 使用区域数据

```typescript
import { REGION_HIERARCHY, getAdministrativeRegion } from '@/lib/regionData';

// 获取所有国家
const countries = Object.keys(REGION_HIERARCHY);

// 获取区域信息
const region = getAdministrativeRegion({
  country: 'China',
  province: 'Beijing',
  district: 'Dongcheng'
});
```

## 数据更新

### 添加新区域

在 `regions.ts` 中的 `REGION_HIERARCHY` 和 `REGION_CENTERS` 中添加新区域数据。

### 添加新产品

在 `products.ts` 中的 `PRODUCT_LIBRARY_CONFIG.products` 数组中添加新产品定义。

## 注意事项

1. **数据一致性**: 确保区域数据和坐标数据匹配
2. **产品验证**: 新产品会自动通过 `ProductLibrary` 的验证机制
3. **类型安全**: 所有数据都使用 TypeScript 类型定义，确保类型安全
