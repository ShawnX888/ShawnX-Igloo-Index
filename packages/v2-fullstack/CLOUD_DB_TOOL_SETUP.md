# 云数据库开发工具配置指南

**更新日期**：2025-01-27

本文档提供将开发工具配置为使用云数据库（AWS RDS PostgreSQL）的详细步骤。

## 数据库连接信息

**云数据库信息**（从凭证文件读取）：
- **Host**: `analysis-dev-postgresql.cz29fkykottg.ap-southeast-1.rds.amazonaws.com`
- **Port**: `5432`
- **Database**: `next_gen_index_dev`
- **Username**: `next_gen_index_dev`
- **Password**: 从凭证文件 `~/Downloads/pg_credentials_next_gen_index_dev_20260119.json` 获取

⚠️ **重要**：连接云数据库需要：
- VPN 连接（如果数据库在私有网络）
- 或 AWS RDS 安全组配置允许您的 IP 地址

## 开发工具配置

### 1. DBeaver 配置

#### 方法 1: 使用命令行自动配置（推荐）

```bash
cd packages/v2-fullstack
dbeaver -con "driver=postgresql|host=analysis-dev-postgresql.cz29fkykottg.ap-southeast-1.rds.amazonaws.com|port=5432|database=next_gen_index_dev|user=next_gen_index_dev|password=gsZlRG@=%\$YN|5f5|name=Igloo Cloud DB|save=true"
```

⚠️ **注意**：密码中的特殊字符需要转义（`$` 需要写成 `\$`，`|` 需要转义）

#### 方法 2: 手动配置（GUI）

1. **启动 DBeaver**：
   ```bash
   open -a DBeaver
   ```

2. **创建新连接**：
   - 点击 "New Database Connection" 图标或按 `Cmd+Shift+N`
   - 在数据库列表中选择 "PostgreSQL"
   - 点击 "Next"

3. **填写连接信息**：
   - **Host**: `analysis-dev-postgresql.cz29fkykottg.ap-southeast-1.rds.amazonaws.com`
   - **Port**: `5432`
   - **Database**: `next_gen_index_dev`
   - **Username**: `next_gen_index_dev`
   - **Password**: `gsZlRG@=%$YN|5f5`（从凭证文件获取）

4. **测试连接**：
   - 点击 "Test Connection" 按钮
   - 如果提示缺少驱动，点击 "Download" 下载 PostgreSQL 驱动
   - 连接成功后，点击 "Finish" 保存连接

5. **关于 PostGIS 扩展**：
   - ⚠️ **重要**：当前云数据库（AWS RDS PostgreSQL 14）不支持安装自定义扩展
   - PostGIS 扩展不可用
   - 项目将不使用 PostGIS 功能

#### 方法 3: 使用配置脚本（如果已创建）

如果项目中有 `setup-dev-tools.sh` 脚本，可以运行：

```bash
cd packages/v2-fullstack
./setup-dev-tools.sh
```

然后按照提示在 DBeaver 中导入连接配置。

### 2. Postman 配置（如使用）

如果 Postman 环境变量中包含数据库连接信息，需要更新：

1. **打开 Postman**：
   ```bash
   open -a Postman
   ```

2. **更新环境变量**：
   - 点击右上角 "Environments" → 选择环境（如 "Local Development"）
   - 更新或添加以下变量：
     - `DATABASE_URL`: `postgresql+asyncpg://next_gen_index_dev:***@analysis-dev-postgresql.cz29fkykottg.ap-southeast-1.rds.amazonaws.com:5432/next_gen_index_dev`
     - 注意：密码需要 URL 编码

3. **保存环境**：
   - 点击 "Save" 保存更改

### 3. RedisInsight 配置

Redis 仍使用本地 Docker，无需更改配置。

## 连接测试

### 使用检查脚本

```bash
cd packages/v2-fullstack
./check-cloud-db.sh
```

脚本会：
- 测试数据库连接
- 检查 PostgreSQL 版本
- 检查 PostGIS 扩展
- 显示数据库编码和时区信息

### 手动测试

#### 使用 psql（如果已安装）

```bash
psql -h analysis-dev-postgresql.cz29fkykottg.ap-southeast-1.rds.amazonaws.com \
     -p 5432 \
     -U next_gen_index_dev \
     -d next_gen_index_dev
```

#### 使用 Python

```python
import psycopg2
import json

# 读取凭证
with open('~/Downloads/pg_credentials_next_gen_index_dev_20260119.json', 'r') as f:
    creds = json.load(f)['next_gen_index_dev']

# 连接数据库
conn = psycopg2.connect(
    host=creds['host'],
    port=creds['port'],
    database=creds['database'],
    user=creds['username'],
    password=creds['password']
)

# 测试查询
cur = conn.cursor()
cur.execute('SELECT version();')
print(cur.fetchone()[0])
```

## 常见问题

### 1. 连接超时

**问题**：连接数据库时出现超时错误

**解决方案**：
- 检查网络连接
- 确认已连接 VPN（如果需要）
- 联系管理员检查 AWS RDS 安全组配置
- 确认数据库实例状态（运行中）

### 2. PostGIS 扩展不可用

**问题**：云数据库不支持 PostGIS 扩展

**说明**：
- 当前云数据库（AWS RDS PostgreSQL 14）不支持安装自定义扩展
- PostGIS 扩展不可用
- 项目将不使用 PostGIS 功能

### 3. 密码特殊字符问题

**问题**：密码中包含特殊字符（`@`, `%`, `$`, `|`）导致连接失败

**解决方案**：
- 在连接字符串中使用 URL 编码
- 在 DBeaver GUI 中直接输入原始密码（会自动处理）
- 在命令行中使用转义字符

### 4. 安全组配置

**问题**：无法从本地连接到 AWS RDS

**解决方案**：
- 联系 AWS 管理员将您的 IP 地址添加到 RDS 安全组
- 或使用 VPN 连接到数据库所在的 VPC

## 回滚到本地数据库

如果需要回滚到本地 Docker PostgreSQL：

1. **恢复环境变量**：
   ```bash
   # 编辑 .env 文件，将 DATABASE_URL 改回本地配置
   DATABASE_URL=postgresql+asyncpg://igloo:igloo_dev@localhost:5432/igloo_index
   ```

2. **启动本地 PostgreSQL**：
   ```bash
   # 取消注释 docker-compose.yml 中的 postgres 服务
   # 然后启动
   docker compose up -d postgres
   ```

3. **更新 DBeaver 连接**：
   - 在 DBeaver 中更新连接配置为本地数据库
   - 或创建新的本地数据库连接

## 验证清单

迁移完成后，请验证以下项目：

- [ ] 数据库连接检查脚本运行成功
- [ ] DBeaver 可以连接到云数据库
- [ ] 确认不使用 PostGIS 功能（当前云数据库不支持）
- [ ] 后端应用可以连接到云数据库
- [ ] 环境变量正确加载
- [ ] 所有开发工具配置已更新

## 相关文档

- [开发工具配置指南](DEV_TOOLS_SETUP.md)
- [工具和环境配置进度](Tool_Env_SETUP.md)
- [数据库检查脚本](check-cloud-db.sh)
- [迁移脚本](migrate-to-cloud-db.sh)
