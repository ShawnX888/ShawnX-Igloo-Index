# 03-Google Maps API配置与初始化

## 步骤概述

### 步骤编号和名称
**步骤03**：Google Maps API配置与初始化

### 步骤目标
配置Google Maps JavaScript API，完成API Key设置、动态库加载和基础地图容器的创建，为后续地图功能开发奠定基础。可以使用步骤02中定义的类型，获得更好的类型提示和类型检查。

### 预期成果
- Google Maps JavaScript API成功加载
- 地图容器可以正常显示基础地图
- API Key配置正确，地图可以正常渲染
- 为后续步骤提供可用的地图实例
- 使用步骤02中定义的类型，代码类型安全

---

## 前置条件

### 依赖的步骤
- **步骤02**：项目结构优化与类型定义（推荐先完成，可以使用已定义的类型）

**说明**：
- 步骤02定义了核心类型和接口，步骤03配置API时可以使用这些类型
- 如果步骤02已完成，步骤03可以获得更好的类型提示和类型检查
- 如果步骤02未完成，步骤03也可以独立进行，但建议先完成步骤02

### 需要完成的前置工作
- 确认项目已安装所有依赖（`npm install`）
- 确认API Key可用（已在workspace rules中配置）
- 推荐：步骤02已完成，类型定义已就绪

### 需要的数据/接口
- Google Maps JavaScript API Key：`AIzaSyDySKOyx0ilGmORM-8px8Hx45jb9s28zms`
- Google Cloud Project：`axinan-dev`
- 类型定义：步骤02中定义的类型（如果已完成）

---

## 实现要点

### 核心功能点

1. **API Key配置**
   - 在环境变量或配置文件中设置API Key
   - 确保API Key安全，不在代码中硬编码（开发环境可以例外）

2. **动态库加载**
   - 使用`google.maps.importLibrary`动态加载所需库
   - 加载`maps`库（基础地图功能）
   - 加载`marker`库（用于后续标记功能）
   - 加载`maps/data`库（用于数据图层）

3. **地图容器创建**
   - 在`MapWorkspace`组件中创建地图容器div
   - 使用`useEffect`初始化地图实例
   - 配置地图初始中心点和缩放级别
   - 使用步骤02中定义的类型（如`Region`、地图配置类型等）

4. **地图配置**
   - 设置Map ID（如果需要自定义样式）
   - 配置地图选项（中心点、缩放级别、地图类型等）
   - 添加必要的Attribution信息

### 技术实现方案

#### 1. API加载方式
使用动态库加载（`importLibrary`）而非静态script标签，符合Google Maps Platform最佳实践：

```typescript
// 伪代码示例（不写具体实现）
const { Map } = await google.maps.importLibrary("maps") as google.maps.MapsLibrary;
const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
const { Data } = await google.maps.importLibrary("maps/data");
```

#### 2. 地图初始化
在`MapWorkspace`组件中使用`useEffect`初始化地图，使用步骤02中定义的类型：

```typescript
// 伪代码示例
import { Region } from '@/types/region';

export function MapWorkspace({ ... }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);

  useEffect(() => {
    // 加载Google Maps库
    // 创建地图实例
    // 配置地图选项（使用步骤02中定义的类型）
    // 将地图绑定到容器div
  }, []);

  return (
    <div className="w-full h-full">
      <div ref={mapRef} id="map-container" className="w-full h-full" />
    </div>
  );
}
```

#### 3. 地图配置选项
- **中心点**：默认设置为印尼雅加达（根据需求文档，可以使用步骤02中定义的`Region`类型）
- **缩放级别**：根据区域范围调整
- **地图类型**：使用默认roadmap或自定义样式
- **版本**：使用`weekly`版本以获取最新功能

### 关键代码结构

#### MapWorkspace组件结构
```typescript
// 伪代码示例
import { Region } from '@/types/region';
import { DateRange } from '@/types/data';

export function MapWorkspace({ 
  selectedRegion,
  dateRange,
  ... 
}: MapWorkspaceProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);

  useEffect(() => {
    // 初始化地图
    // 1. 加载库
    // 2. 创建地图实例
    // 3. 配置选项（使用步骤02中定义的类型）
  }, []);

  return (
    <div className="w-full h-full">
      <div ref={mapRef} id="map-container" className="w-full h-full" />
    </div>
  );
}
```

---

## 输入输出

### 输入
- **API Key**：Google Maps JavaScript API Key
- **地图容器**：HTML div元素（通过ref引用）
- **初始配置**：中心点坐标、缩放级别等（可以使用步骤02中定义的类型）
- **类型定义**：步骤02中定义的类型（如果已完成）

### 输出
- **地图实例**：`google.maps.Map`实例（存储在ref中）
- **已加载的库**：`Map`、`AdvancedMarkerElement`、`Data`等
- **可用的地图容器**：可以在后续步骤中添加图层

---

## 验收标准

### 功能验收标准
- [ ] Google Maps API成功加载，无控制台错误
- [ ] 地图容器可以正常显示基础地图
- [ ] 地图可以正常缩放和拖拽
- [ ] 地图中心点设置为印尼雅加达（或默认区域）
- [ ] 地图实例可以正常访问（通过ref）
- [ ] 如果步骤02已完成，代码使用了已定义的类型，类型检查通过

### 性能验收标准
- [ ] 地图加载时间在3秒内
- [ ] 地图交互（缩放、拖拽）流畅，无明显卡顿

### 技术验收标准
- [ ] 使用动态库加载方式（`importLibrary`）
- [ ] API Key配置正确，地图可以正常渲染
- [ ] 代码结构清晰，便于后续扩展
- [ ] 如果步骤02已完成，代码遵循类型定义规范

---

## 注意事项

### 常见问题
1. **API Key未配置或无效**
   - 检查API Key是否正确
   - 确认API Key已启用Maps JavaScript API

2. **库加载失败**
   - 检查网络连接
   - 确认API Key有足够的配额

3. **地图容器未正确初始化**
   - 确保容器div有明确的宽高
   - 确保在组件挂载后再初始化地图

4. **类型定义未找到**
   - 如果步骤02未完成，可以先使用`@types/google.maps`中的类型
   - 完成步骤02后，可以替换为自定义类型定义

### 技术难点
- **动态库加载的异步处理**：需要正确处理Promise和错误
- **地图实例的生命周期管理**：确保在组件卸载时清理资源
- **类型系统集成**：如果步骤02已完成，需要正确使用已定义的类型

### 扩展性考虑
- 地图实例存储在ref中，便于后续步骤访问
- 地图配置选项可以提取为常量，便于后续修改
- 预留自定义Map ID的配置，便于后续添加自定义样式
- 使用步骤02中定义的类型，确保类型一致性

---

## 下一步

### 后续步骤的准备工作
- 地图实例已创建，可以在步骤10中替换SVG地图
- 地图容器已准备好，可以在步骤11中绘制行政区域边界
- 如果步骤02已完成，类型系统已就绪，后续步骤可以使用这些类型

### 数据/接口的传递
- 地图实例通过ref传递给后续步骤
- 地图配置选项可以在后续步骤中动态更新
- 类型定义通过TypeScript类型系统传递给所有模块

---

**文档版本**：v1.0  
**创建日期**：2025-01-27  
**最后更新**：2025-01-27
