# Google Maps API 配置说明

## 环境变量配置

### 1. 创建 .env 文件

在项目根目录（`Next-gen-index/`）创建 `.env` 文件：

```bash
cd Next-gen-index
touch .env
```

### 2. 配置 API Key 和 Map ID

在 `.env` 文件中添加以下内容：

```
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
VITE_GOOGLE_MAPS_MAP_ID=your_map_id_here
```

**重要提示：**
- 将 `your_google_maps_api_key_here` 替换为实际的 Google Maps API Key
- 将 `your_map_id_here` 替换为支持 3D Buildings 的 Map ID（可选，如果未配置将使用 DEMO_MAP_ID）
- API Key 可以从 `.cursor/rules/google-dev-api-key.mdc` 文件中获取（开发/测试环境）
- **不要**将 `.env` 文件提交到版本控制系统

**Map ID 配置说明：**
- Map ID 用于启用 Advanced Markers 和 3D Buildings 功能
- 如果未配置 Map ID，将使用 `DEMO_MAP_ID`（仅支持基础功能，不支持 3D）
- 要使用 3D 地图功能，必须创建支持 3D Buildings 的自定义 Map ID
- 详细创建步骤请参考：[创建 Map ID 指南](#创建-map-id-指南)

### 3. 验证配置

1. 确保 `.env` 文件在 `.gitignore` 中（已配置）
2. 重启开发服务器：
   ```bash
   npm run dev
   ```
3. 打开浏览器控制台，检查是否有 Google Maps 加载错误

## API Key 获取

### 开发/测试环境

项目已配置开发/测试环境的 API Key，详细信息请参考：
- `.cursor/rules/google-dev-api-key.mdc`

### 生产环境

生产环境应使用：
- 环境变量或安全的密钥管理服务
- 限制 API Key 的使用范围（HTTP referrers、IP 地址、API 限制）

## 已启用的 Google API

根据项目配置，以下 API 已启用：

1. **Maps JavaScript API** - 用于地图渲染
2. **Geocoding API** - 用于地址与坐标转换
3. **Weather API** - 用于天气数据（未来使用）

## 故障排除

### API Key 未配置

如果看到 "API Key not configured" 错误：
1. 检查 `.env` 文件是否存在
2. 检查 `VITE_GOOGLE_MAPS_API_KEY` 是否正确设置
3. 重启开发服务器

### 地图加载失败

如果地图无法加载：
1. 检查网络连接
2. 检查 API Key 是否有效
3. 检查浏览器控制台的错误信息
4. 确认 API Key 已启用 Maps JavaScript API

### 类型错误

如果遇到 TypeScript 类型错误：
1. 确保 `src/types/google.maps.d.ts` 文件存在
2. 在生产环境中，建议安装 `@types/google.maps` 包：
   ```bash
   npm install --save-dev @types/google.maps
   ```

## 创建 Map ID 指南

### 为什么需要 Map ID？

Map ID 用于：
- 启用 **Advanced Markers**（高级标记功能）
- 启用 **3D Buildings**（3D 建筑物显示）
- 自定义地图样式（可选）

### 创建步骤

1. **访问 Google Cloud Console**
   - 打开 [Google Cloud Console](https://console.cloud.google.com/)
   - 选择项目：`axinan-dev`

2. **进入 Maps 管理页面**
   - 在左侧菜单中，点击 **"Maps"** > **"Map Styles"**
   - 或者直接访问：https://console.cloud.google.com/google/maps-apis/map-styles

3. **创建新的 Map ID**
   - 点击 **"Create Map ID"** 按钮
   - 填写 Map ID 名称（例如：`igloo-index-3d-map`）
   - 选择 **"Map type"**：选择 **"Vector"**（矢量地图，支持 3D）

4. **配置地图样式**
   - 在 **"Map style"** 部分，选择 **"Standard"** 或自定义样式
   - **重要**：确保启用 **"3D Buildings"** 选项
   - 点击 **"Create"** 完成创建

5. **复制 Map ID**
   - 创建完成后，复制生成的 Map ID（格式类似：`abc123def456`）
   - 将 Map ID 添加到 `.env` 文件中的 `VITE_GOOGLE_MAPS_MAP_ID`

### 验证 Map ID

1. 在 `.env` 文件中配置 Map ID
2. 重启开发服务器
3. 打开地图页面，切换到 3D 模式
4. 如果能看到 3D 建筑物，说明 Map ID 配置成功

### 注意事项

- Map ID 与 API Key 关联，确保使用同一项目的 API Key
- 如果未配置 Map ID，代码会使用 `DEMO_MAP_ID`（不支持 3D 功能）
- 3D Buildings 功能需要较高的缩放级别（zoom >= 15）才能看到效果

## 相关文档

- [Google Maps JavaScript API 文档](https://developers.google.com/maps/documentation/javascript?utm_source=gmp-code-assist)
- [Map ID 配置指南](https://developers.google.com/maps/documentation/javascript/maptypes#map_id)
- [3D Maps API 文档](https://developers.google.com/maps/documentation/javascript/reference/3.60/3d-map)
- [项目技术方案](../doc/技术方案.md)
- [步骤03实现文档](../doc/03-Google-Maps-API配置与初始化.md)
- [步骤24-3D地图文档](../doc/24-3D地图.md)

