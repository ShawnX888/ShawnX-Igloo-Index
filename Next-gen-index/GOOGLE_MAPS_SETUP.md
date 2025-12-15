# Google Maps API 配置说明

## 环境变量配置

### 1. 创建 .env 文件

在项目根目录（`Next-gen-index/`）创建 `.env` 文件：

```bash
cd Next-gen-index
touch .env
```

### 2. 配置 API Key

在 `.env` 文件中添加以下内容：

```
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
```

**重要提示：**
- 将 `your_google_maps_api_key_here` 替换为实际的 Google Maps API Key
- API Key 可以从 `.cursor/rules/google-dev-api-key.mdc` 文件中获取（开发/测试环境）
- **不要**将 `.env` 文件提交到版本控制系统

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

## 相关文档

- [Google Maps JavaScript API 文档](https://developers.google.com/maps/documentation/javascript?utm_source=gmp-code-assist)
- [项目技术方案](../doc/技术方案.md)
- [步骤03实现文档](../doc/03-Google-Maps-API配置与初始化.md)

