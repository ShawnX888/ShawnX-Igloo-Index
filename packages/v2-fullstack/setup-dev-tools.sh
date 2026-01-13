#!/bin/bash

# 开发工具自动配置脚本
# 用途：自动配置 DBeaver、Postman、RedisInsight 的连接信息
# 更新日期：2025-01-27

set -e  # 遇到错误立即退出

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置信息（从 docker-compose.yml 读取）
DB_HOST="localhost"
DB_PORT="5432"
DB_NAME="igloo_index"
DB_USER="igloo"
DB_PASSWORD="igloo_dev"

REDIS_HOST="localhost"
REDIS_PORT="6379"
REDIS_ALIAS="Igloo Local Redis"

API_BASE_URL="http://localhost:8000"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  开发工具自动配置脚本${NC}"
echo -e "${BLUE}========================================${NC}\n"

# 检查 Docker 服务是否运行
echo -e "${YELLOW}[1/4] 检查 Docker 服务状态...${NC}"
if ! docker compose ps | grep -q "igloo-postgres.*healthy"; then
    echo -e "${RED}❌ PostgreSQL 服务未运行或未就绪${NC}"
    echo -e "${YELLOW}   请先运行: docker compose up -d${NC}"
    exit 1
fi

if ! docker compose ps | grep -q "igloo-redis.*healthy"; then
    echo -e "${RED}❌ Redis 服务未运行或未就绪${NC}"
    echo -e "${YELLOW}   请先运行: docker compose up -d${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Docker 服务运行正常${NC}\n"

# 配置 DBeaver
echo -e "${YELLOW}[2/4] 配置 DBeaver 数据库连接...${NC}"
if [ -d "/Applications/DBeaver.app" ]; then
    # 使用 DBeaver 命令行参数创建连接
    CONNECTION_NAME="Igloo PostgreSQL"
    CONNECTION_STRING="driver=postgresql|host=${DB_HOST}|port=${DB_PORT}|database=${DB_NAME}|user=${DB_USER}|password=${DB_PASSWORD}|name=${CONNECTION_NAME}"
    
    # 尝试通过命令行创建连接
    if /Applications/DBeaver.app/Contents/MacOS/dbeaver -con "$CONNECTION_STRING" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ DBeaver 连接配置已创建${NC}"
        echo -e "   连接名称: ${CONNECTION_NAME}"
        echo -e "   数据库: ${DB_NAME}@${DB_HOST}:${DB_PORT}"
    else
        echo -e "${YELLOW}⚠️  DBeaver 命令行配置可能失败，请手动验证${NC}"
        echo -e "   手动配置步骤："
        echo -e "   1. 打开 DBeaver: open -a DBeaver"
        echo -e "   2. 创建新连接 (Cmd+Shift+N)"
        echo -e "   3. 选择 PostgreSQL"
        echo -e "   4. 填写连接信息："
        echo -e "      Host: ${DB_HOST}"
        echo -e "      Port: ${DB_PORT}"
        echo -e "      Database: ${DB_NAME}"
        echo -e "      Username: ${DB_USER}"
        echo -e "      Password: ${DB_PASSWORD}"
    fi
else
    echo -e "${RED}❌ DBeaver 未安装${NC}"
    echo -e "   安装命令: brew install --cask dbeaver-community"
fi
echo ""

# 配置 RedisInsight
echo -e "${YELLOW}[3/4] 配置 RedisInsight 连接...${NC}"
if [ -d "/Applications/Redis Insight.app" ]; then
    # 创建 RedisInsight 配置文件目录
    REDISINSIGHT_CONFIG_DIR="$HOME/.redisinsight"
    mkdir -p "$REDISINSIGHT_CONFIG_DIR"
    
    # 创建数据库配置文件
    DATABASES_JSON="$REDISINSIGHT_CONFIG_DIR/databases.json"
    cat > "$DATABASES_JSON" <<EOF
[
  {
    "id": "igloo-local-$(date +%s)",
    "host": "${REDIS_HOST}",
    "port": ${REDIS_PORT},
    "name": "${REDIS_ALIAS}",
    "username": "",
    "password": ""
  }
]
EOF
    
    # 设置环境变量（用于 RedisInsight 启动时读取）
    export RI_PRE_SETUP_DATABASES_PATH="$DATABASES_JSON"
    
    echo -e "${GREEN}✅ RedisInsight 配置文件已创建${NC}"
    echo -e "   配置文件: ${DATABASES_JSON}"
    echo -e "   连接信息: ${REDIS_ALIAS}@${REDIS_HOST}:${REDIS_PORT}"
    echo -e "${YELLOW}   注意: 需要重启 RedisInsight 才能生效${NC}"
    echo -e "   重启命令: killall 'Redis Insight' 2>/dev/null; open -a 'Redis Insight'"
else
    echo -e "${RED}❌ RedisInsight 未安装${NC}"
    echo -e "   安装命令: brew install --cask redis-insight"
fi
echo ""

# 配置 Postman
echo -e "${YELLOW}[4/4] 配置 Postman 环境...${NC}"
if [ -d "/Applications/Postman.app" ]; then
    # 创建 Postman 环境配置文件
    POSTMAN_CONFIG_DIR="$HOME/.postman"
    mkdir -p "$POSTMAN_CONFIG_DIR"
    
    # 创建环境变量 JSON 文件（Postman 格式）
    ENVIRONMENT_JSON="$POSTMAN_CONFIG_DIR/igloo-local-development.json"
    cat > "$ENVIRONMENT_JSON" <<EOF
{
  "name": "Igloo Local Development",
  "values": [
    {
      "key": "base_url",
      "value": "${API_BASE_URL}",
      "enabled": true
    },
    {
      "key": "api_version",
      "value": "v1",
      "enabled": true
    },
    {
      "key": "database_host",
      "value": "${DB_HOST}",
      "enabled": true
    },
    {
      "key": "database_port",
      "value": "${DB_PORT}",
      "enabled": true
    },
    {
      "key": "database_name",
      "value": "${DB_NAME}",
      "enabled": true
    },
    {
      "key": "redis_host",
      "value": "${REDIS_HOST}",
      "enabled": true
    },
    {
      "key": "redis_port",
      "value": "${REDIS_PORT}",
      "enabled": true
    }
  ],
  "_postman_variable_scope": "environment"
}
EOF
    
    echo -e "${GREEN}✅ Postman 环境配置文件已创建${NC}"
    echo -e "   配置文件: ${ENVIRONMENT_JSON}"
    echo -e "   环境名称: Igloo Local Development"
    echo -e "${YELLOW}   手动导入步骤：${NC}"
    echo -e "   1. 打开 Postman: open -a Postman"
    echo -e "   2. 点击右上角 'Environments' → 'Import'"
    echo -e "   3. 选择文件: ${ENVIRONMENT_JSON}"
    echo -e "   4. 或使用 Postman CLI 导入（需要 API Key）"
else
    echo -e "${RED}❌ Postman 未安装${NC}"
    echo -e "   安装命令: brew install --cask postman"
fi
echo ""

# 总结
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ 配置完成！${NC}"
echo -e "${BLUE}========================================${NC}\n"

echo -e "${YELLOW}配置摘要：${NC}"
echo -e "  📊 DBeaver: PostgreSQL 连接"
echo -e "     → ${DB_NAME}@${DB_HOST}:${DB_PORT}"
echo -e ""
echo -e "  🔴 RedisInsight: Redis 连接"
echo -e "     → ${REDIS_ALIAS}@${REDIS_HOST}:${REDIS_PORT}"
echo -e "     → 配置文件: ${REDISINSIGHT_CONFIG_DIR}/databases.json"
echo -e "     → ${YELLOW}需要重启 RedisInsight 生效${NC}"
echo -e ""
echo -e "  📮 Postman: 环境变量"
echo -e "     → Igloo Local Development"
echo -e "     → 配置文件: ${POSTMAN_CONFIG_DIR}/igloo-local-development.json"
echo -e "     → ${YELLOW}需要手动导入到 Postman${NC}"
echo -e ""

echo -e "${BLUE}下一步操作：${NC}"
echo -e "  1. 验证 DBeaver 连接（如果命令行配置失败，请手动配置）"
echo -e "  2. 重启 RedisInsight 以加载配置"
echo -e "  3. 在 Postman 中导入环境配置文件"
echo -e ""

echo -e "${GREEN}🎉 开发工具配置完成！${NC}"
