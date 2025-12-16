# GADM 行政区域数据

本目录包含从 GADM (Global Administrative Areas) 转换而来的行政区域边界数据。

## 数据来源

- **GADM**: https://gadm.org/
- **版本**: GADM 4.1
- **级别**: Level 2 (国家 → 省/州 → 市/区)

## 数据文件说明

### 按国家分类的文件

每个国家包含以下文件：
- `{country}_regions.json`: 完整的区域数据（包含边界坐标）
- `{country}_index.json`: 区域索引（用于快速查找）
- `{country}_hierarchy.json`: 层级关系（国家 → 省/州 → 市/区）
- `{country}_centers.json`: 区域中心点坐标

### 合并文件

- `merged_index.json`: 所有国家的区域索引
- `merged_hierarchy.json`: 所有国家的层级关系
- `merged_centers.json`: 所有国家的中心点坐标

## 数据结构

### ConvertedRegion

```typescript
interface ConvertedRegion {
  country: string;           // 国家名称（英文）
  province: string;          // 省/州名称（英文）
  district: string;         // 市/区名称（英文）
  center: {                 // 区域中心点
    lat: number;
    lng: number;
  };
  boundary: Array<{         // 边界坐标（GeoJSON格式）
    lat: number;
    lng: number;
  }>;
  localNames?: {            // 本地语言名称（可选）
    province?: string;
    district?: string;
  };
}
```

## 使用方法

### 1. 使用 GADM 数据加载器

```typescript
import * as gadmLoader from '@/lib/gadmDataLoader';

// 获取区域边界
const boundary = await gadmLoader.getRegionBoundary({
  country: 'China',
  province: 'Beijing',
  district: 'Beijing'
});

// 获取区域中心点
const center = await gadmLoader.getRegionCenter({
  country: 'China',
  province: 'Beijing',
  district: 'Beijing'
});

// 搜索区域
const results = await gadmLoader.searchRegions('Beijing');

// 获取层级关系
const hierarchy = await gadmLoader.getRegionHierarchy();
```

### 2. 使用区域数据管理模块（推荐）

```typescript
import {
  getRegionBoundary,
  getAdministrativeRegion,
  searchRegions
} from '@/lib/regionData';

// 自动使用 GADM 数据（如果可用），否则回退到静态数据
const boundary = await getRegionBoundary({
  country: 'China',
  province: 'Beijing',
  district: 'Beijing'
});

const region = await getAdministrativeRegion({
  country: 'China',
  province: 'Beijing',
  district: 'Beijing'
});

const results = await searchRegions('Beijing');
```

### 3. 使用 React Hook

```typescript
import { useRegionData } from '@/hooks/useRegionData';

function MyComponent() {
  const { search, getRegion, getCountries } = useRegionData();
  
  // 搜索区域
  const handleSearch = async (query: string) => {
    const results = await search(query);
    console.log(results);
  };
  
  // 获取区域信息
  const handleGetRegion = async () => {
    const region = await getRegion({
      country: 'China',
      province: 'Beijing',
      district: 'Beijing'
    });
    console.log(region);
  };
}
```

## 数据更新

如果需要更新数据，运行转换脚本：

```bash
cd Next-gen-index
npx tsx ../scripts/convertGadmData.ts
```

## 注意事项

1. **数据大小**: GADM 数据文件较大（总计约 200MB），首次加载可能需要一些时间
2. **异步加载**: 所有 GADM 数据访问都是异步的，需要使用 `await` 或 `.then()`
3. **回退机制**: 如果 GADM 数据不可用，系统会自动回退到静态数据
4. **缓存**: 数据加载后会缓存在内存中，后续访问会更快

## 支持的国家

当前支持以下国家的 GADM 数据：
- 🇨🇳 中国 (China)
- 🇺🇸 美国 (United States)
- 🇮🇩 印尼 (Indonesia)
- 🇹🇭 泰国 (Thailand)
- 🇻🇳 越南 (Vietnam)
- 🇲🇾 马来西亚 (Malaysia)

## 性能优化建议

1. **预加载**: 在应用启动时预加载 GADM 数据
   ```typescript
   import { preloadGADMData } from '@/lib/gadmDataLoader';
   preloadGADMData();
   ```

2. **按需加载**: 只加载需要的国家数据（未来可优化）

3. **数据压缩**: 考虑使用简化算法减少边界坐标点数量（未来可优化）

