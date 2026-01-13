# Docker Desktop 安装指南

**系统信息**：
- macOS 版本：darwin 23.6.0 (macOS 14.x)
- 架构：**Intel (x86_64)** - Intel Core i5
- 需要下载：**Mac with Intel chip** 版本

## 安装步骤

### 1. 下载 Docker Desktop

**根据您的 Mac 架构选择：**

#### ✅ 您的 Mac 是 Intel 架构
- **直接下载地址**：https://desktop.docker.com/mac/main/amd64/Docker.dmg
- **或访问官网**：https://www.docker.com/products/docker-desktop/
- **选择**："Mac with Intel chip" 版本

#### Apple Silicon (M1/M2/M3) Mac（参考）
- 下载地址：https://desktop.docker.com/mac/main/arm64/Docker.dmg
- 选择 "Mac with Apple Silicon" 版本

### 2. 安装 Docker Desktop

1. 打开下载的 `.dmg` 文件
2. 将 Docker 图标拖拽到 Applications 文件夹
3. 打开 Applications 文件夹，双击 Docker 图标启动
4. 首次启动可能需要输入管理员密码
5. 等待 Docker Desktop 完全启动（菜单栏会出现 Docker 图标）

### 3. 验证安装

安装完成后，在终端运行以下命令验证：

```bash
# 验证 Docker 版本
docker --version

# 验证 Docker Compose 版本
docker compose version

# 测试 Docker 是否正常运行
docker run hello-world
```

**预期输出**：
- `docker --version` 应显示类似：`Docker version 24.x.x, build xxxxx`
- `docker compose version` 应显示类似：`Docker Compose version v2.x.x`
- `docker run hello-world` 应成功运行并显示 "Hello from Docker!" 消息

### 4. 配置 Docker Desktop（推荐设置）

1. 打开 Docker Desktop
2. 点击设置图标（齿轮）
3. 在 **Resources** 选项卡中：
   - 分配至少 **4GB 内存**给 Docker（推荐 8GB）
   - 分配至少 **2 CPU 核心**
4. 在 **General** 选项卡中：
   - 取消勾选 "Use Docker Compose V2"（如果使用旧版本）
   - 或确保使用 Docker Compose V2（推荐）

### 5. 常见问题

#### 问题：Docker Desktop 无法启动
- **解决**：检查系统要求，确保 macOS 版本 >= 10.15
- **解决**：重启 Mac 后再次尝试

#### 问题：端口被占用（5432, 6379）
- **解决**：检查是否有其他服务占用这些端口
- **解决**：在 docker-compose.yml 中修改端口映射

#### 问题：Docker 命令找不到
- **解决**：确保 Docker Desktop 正在运行
- **解决**：重启终端或重新加载 shell 配置

## 安装后下一步

安装完成后，继续执行：

1. 验证 Docker 安装
2. 创建 Docker Compose 配置文件
3. 启动 PostgreSQL + PostGIS 和 Redis 服务

## 快速验证脚本

安装完成后，运行以下命令快速验证：

```bash
# 检查 Docker 是否安装
if command -v docker &> /dev/null; then
    echo "✅ Docker 已安装"
    docker --version
    docker compose version
    echo "✅ 测试运行容器..."
    docker run --rm hello-world
else
    echo "❌ Docker 未安装，请按照上述步骤安装"
fi
```