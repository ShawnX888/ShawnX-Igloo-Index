#!/bin/bash

# Docker 安装验证脚本
# 使用方法：./verify-docker.sh

echo "🔍 检查 Docker 安装状态..."
echo ""

# 检查 Docker 命令是否可用
if command -v docker &> /dev/null; then
    echo "✅ Docker 命令已找到"
    docker --version
else
    echo "❌ Docker 命令未找到"
    echo "   请确保已安装 Docker Desktop 并正在运行"
    exit 1
fi

echo ""

# 检查 Docker Compose 命令是否可用
if docker compose version &> /dev/null; then
    echo "✅ Docker Compose 已找到"
    docker compose version
elif docker-compose --version &> /dev/null; then
    echo "✅ Docker Compose (旧版本) 已找到"
    docker-compose --version
else
    echo "❌ Docker Compose 未找到"
    exit 1
fi

echo ""

# 检查 Docker daemon 是否运行
if docker info &> /dev/null; then
    echo "✅ Docker daemon 正在运行"
else
    echo "❌ Docker daemon 未运行"
    echo "   请启动 Docker Desktop 应用程序"
    exit 1
fi

echo ""

# 测试运行容器
echo "🧪 测试运行容器..."
if docker run --rm hello-world &> /dev/null; then
    echo "✅ Docker 容器运行测试成功"
    docker run --rm hello-world | head -5
else
    echo "❌ Docker 容器运行测试失败"
    exit 1
fi

echo ""
echo "🎉 Docker 安装验证完成！所有检查通过。"
echo ""
echo "下一步："
echo "1. 创建 docker-compose.yml 配置文件"
echo "2. 启动 PostgreSQL + PostGIS 和 Redis 服务"
