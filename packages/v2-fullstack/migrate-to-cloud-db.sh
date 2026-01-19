#!/bin/bash
# 云数据库迁移脚本
# 用途：自动化更新所有配置文件以使用云数据库

set -e

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 凭证文件路径
CREDENTIALS_FILE="$HOME/Downloads/pg_credentials_next_gen_index_dev_20260119.json"
PYTHON_ENV="/Users/zhushixie/miniconda3/envs/Igloo-python=3.12"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${BLUE}🚀 开始云数据库迁移配置...${NC}"
echo ""

# 检查凭证文件
if [ ! -f "$CREDENTIALS_FILE" ]; then
    echo -e "${RED}❌ 凭证文件不存在: $CREDENTIALS_FILE${NC}"
    echo "请确保凭证文件在正确的位置"
    exit 1
fi

echo -e "${GREEN}✅ 找到凭证文件${NC}"

# 使用 Python 处理配置更新
$PYTHON_ENV/bin/python << 'PYTHON_SCRIPT'
import json
import urllib.parse
import os
import sys

# 读取凭证
try:
    with open('/Users/zhushixie/Downloads/pg_credentials_next_gen_index_dev_20260119.json', 'r') as f:
        creds = json.load(f)['next_gen_index_dev']
except Exception as e:
    print(f"❌ 读取凭证文件失败: {e}")
    sys.exit(1)

# URL 编码密码
password_encoded = urllib.parse.quote(creds['password'], safe='')
database_url = f"postgresql+asyncpg://{creds['username']}:{password_encoded}@{creds['host']}:{creds['port']}/{creds['database']}"

print(f"📋 数据库信息:")
print(f"   Host: {creds['host']}")
print(f"   Database: {creds['database']}")
print(f"   User: {creds['username']}")
print("")

# 需要更新的文件
env_files = [
    '/Users/zhushixie/Coding/ShawnX-Igloo-Index/packages/v2-fullstack/.env',
    '/Users/zhushixie/Coding/ShawnX-Igloo-Index/packages/v2-fullstack/backend/.env',
]

updated_count = 0
for env_file in env_files:
    if os.path.exists(env_file):
        # 读取现有内容
        with open(env_file, 'r') as f:
            lines = f.readlines()
        
        # 检查是否已经是云数据库配置
        is_cloud_db = False
        for line in lines:
            if 'analysis-dev-postgresql' in line or 'next_gen_index_dev' in line:
                is_cloud_db = True
                break
        
        if is_cloud_db:
            print(f"⏭️  已配置云数据库: {os.path.basename(env_file)}")
            continue
        
        # 更新或添加 DATABASE_URL
        updated = False
        new_lines = []
        for line in lines:
            if line.strip().startswith('DATABASE_URL='):
                new_lines.append(f'DATABASE_URL={database_url}\n')
                updated = True
            else:
                new_lines.append(line)
        
        # 如果没有找到，添加到文件末尾
        if not updated:
            new_lines.append(f'\n# Cloud Database Configuration\nDATABASE_URL={database_url}\n')
        
        # 写回文件
        with open(env_file, 'w') as f:
            f.writelines(new_lines)
        
        print(f"✅ 已更新: {os.path.basename(env_file)}")
        updated_count += 1
    else:
        # 创建新文件
        with open(env_file, 'w') as f:
            f.write(f'# Cloud Database Configuration\nDATABASE_URL={database_url}\n')
        print(f"✅ 已创建: {os.path.basename(env_file)}")
        updated_count += 1

if updated_count > 0:
    print(f"\n✅ 已更新 {updated_count} 个环境变量文件")
else:
    print(f"\n✅ 所有配置文件已是最新状态")

print(f"\n📝 DATABASE_URL 格式:")
print(f"   postgresql+asyncpg://{creds['username']}:***@{creds['host']}:{creds['port']}/{creds['database']}")

PYTHON_SCRIPT

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ 环境变量配置完成${NC}"
    echo ""
    echo -e "${YELLOW}📝 下一步操作:${NC}"
    echo "  1. 运行数据库连接检查: ./check-cloud-db.sh"
    echo "  2. 更新开发工具配置（DBeaver）: 参考 DEV_TOOLS_SETUP.md"
    echo "  3. 验证后端应用连接: 启动 FastAPI 并测试 /health 端点"
else
    echo -e "${RED}❌ 配置更新失败${NC}"
    exit 1
fi
