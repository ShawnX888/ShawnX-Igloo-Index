# Google Maps API 故障排查指南

## 错误：SyntaxError: Unexpected token '<', "<!doctype "... is not valid JSON

这个错误表示 Google Maps API 返回了 HTML 页面而不是 JavaScript 代码。通常是因为 API Key 配置问题。

## 排查步骤

### 1. 检查 API Key 配置

**检查 `.env` 文件：**
```bash
# 在 Next-gen-index 目录下
cat .env
```

确保包含：
```
VITE_GOOGLE_MAPS_API_KEY=your_actual_api_key_here
```

**注意：**
- API Key 应该以 `AIza` 开头
- 长度通常在 39 个字符左右
- 不要包含引号或空格

### 2. 验证 API Key 有效性

在浏览器中直接访问以下 URL（替换 `YOUR_API_KEY`）：
```
https://maps.googleapis.com/maps/api/js?key=YOUR_API_KEY&v=weekly&loading=async&callback=test
```

**如果返回 HTML 错误页面：**
- API Key 无效
- API Key 未启用
- API Key 限制配置错误

**如果返回 JavaScript 代码：**
- API Key 有效，问题可能在代码中

### 3. 检查 Google Cloud Console 配置

1. **启用 Maps JavaScript API**
   - 访问 [Google Cloud Console](https://console.cloud.google.com/)
   - 选择项目：`axinan-dev`
   - 进入 "APIs & Services" > "Library"
   - 搜索 "Maps JavaScript API"
   - 确保已启用

2. **检查 API Key 限制**
   - 进入 "APIs & Services" > "Credentials"
   - 找到你的 API Key
   - 检查 "API restrictions"：
     - 应该包含 "Maps JavaScript API"
     - 或者设置为 "Don't restrict key"
   - 检查 "Application restrictions"：
     - 如果设置了 HTTP referrer 限制，确保包含你的域名（如 `localhost:5173`）
     - 如果设置了 IP 限制，确保包含你的 IP 地址

### 4. 检查网络连接

确保可以访问 Google Maps API：
```bash
curl -I https://maps.googleapis.com/maps/api/js
```

应该返回 `200 OK`。

### 5. 检查浏览器控制台

打开浏览器开发者工具（F12），查看：
- **Network 标签**：检查 `maps/api/js` 请求的状态码
  - `200`：请求成功，但可能返回了错误页面
  - `403`：API Key 无效或未授权
  - `404`：URL 错误
  - 其他：网络或服务器问题

- **Console 标签**：查看详细的错误信息

### 6. 常见错误和解决方案

#### 错误：`RefererNotAllowedMapError`
**原因**：API Key 的 HTTP referrer 限制配置错误
**解决**：在 Google Cloud Console 中添加你的域名到允许列表

#### 错误：`ApiNotActivatedMapError`
**原因**：Maps JavaScript API 未启用
**解决**：在 Google Cloud Console 中启用 Maps JavaScript API

#### 错误：`InvalidKeyMapError`
**原因**：API Key 无效
**解决**：检查 API Key 是否正确，是否属于正确的项目

#### 错误：`OverQueryLimitMapError`
**原因**：API 配额超限
**解决**：检查配额使用情况，等待配额重置或升级计划

### 7. 测试 API Key

使用以下命令测试 API Key（在项目根目录）：
```bash
# 替换 YOUR_API_KEY 为实际的 API Key
curl "https://maps.googleapis.com/maps/api/js?key=YOUR_API_KEY&v=weekly&loading=async"
```

如果返回 JavaScript 代码，API Key 有效。
如果返回 HTML 错误页面，查看错误信息。

### 8. 环境变量检查

确保 Vite 正确读取环境变量：

1. **重启开发服务器**
   ```bash
   # 停止当前服务器 (Ctrl+C)
   # 然后重新启动
   npm run dev
   ```

2. **检查环境变量是否加载**
   在代码中添加临时日志：
   ```typescript
   console.log('API Key:', import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.substring(0, 10) + '...');
   ```

3. **确保 `.env` 文件在正确位置**
   - 应该在 `Next-gen-index/` 目录下
   - 不是 `Next-gen-index/.env.local` 或其他位置

### 9. 临时解决方案（仅用于测试）

如果急需测试，可以临时在代码中硬编码 API Key（**仅用于开发测试，不要提交到 Git**）：

```typescript
const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'YOUR_API_KEY_HERE';
```

**重要**：测试完成后，立即移除硬编码的 API Key，使用环境变量。

## 获取帮助

如果以上步骤都无法解决问题：

1. 检查 [Google Maps Platform 文档](https://developers.google.com/maps/documentation/javascript/load-maps-js-api)
2. 查看 [Google Cloud Console 的 API 使用情况](https://console.cloud.google.com/apis/dashboard)
3. 检查 [Google Maps Platform 状态页面](https://status.cloud.google.com/)

## 相关文档

- [Google Maps JavaScript API 文档](https://developers.google.com/maps/documentation/javascript?utm_source=gmp-code-assist)
- [API Key 最佳实践](https://developers.google.com/maps/api-security-best-practices)
- [故障排查指南](https://developers.google.com/maps/documentation/javascript/error-messages)

