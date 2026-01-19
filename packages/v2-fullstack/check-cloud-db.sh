#!/bin/bash
# 云数据库连接检查脚本
# 用途：检查云数据库连接状态（注意：云数据库不支持 PostGIS 扩展）

set -e

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 凭证文件路径
CREDENTIALS_FILE="$HOME/Downloads/pg_credentials_next_gen_index_dev_20260119.json"
PYTHON_ENV="/Users/zhushixie/miniconda3/envs/Igloo-python=3.12"

echo "🔍 检查云数据库连接状态..."
echo ""

# 检查凭证文件是否存在
if [ ! -f "$CREDENTIALS_FILE" ]; then
    echo -e "${RED}❌ 凭证文件不存在: $CREDENTIALS_FILE${NC}"
    echo "请确保凭证文件在正确的位置"
    exit 1
fi

echo -e "${GREEN}✅ 找到凭证文件${NC}"

# 使用 Python 检查数据库连接
$PYTHON_ENV/bin/python << 'PYTHON_SCRIPT'
import json
import sys
import urllib.parse

try:
    import psycopg2
except ImportError:
    print("❌ 缺少 psycopg2 模块，正在安装...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "psycopg2-binary", "--quiet"])
    import psycopg2

# 读取凭证
try:
    with open('/Users/zhushixie/Downloads/pg_credentials_next_gen_index_dev_20260119.json', 'r') as f:
        creds = json.load(f)['next_gen_index_dev']
except Exception as e:
    print(f"❌ 读取凭证文件失败: {e}")
    sys.exit(1)

print(f"📋 数据库信息:")
print(f"   Host: {creds['host']}")
print(f"   Port: {creds['port']}")
print(f"   Database: {creds['database']}")
print(f"   User: {creds['username']}")
print("")

# 测试连接
try:
    print("🔌 正在连接数据库...")
    conn = psycopg2.connect(
        host=creds['host'],
        port=creds['port'],
        database=creds['database'],
        user=creds['username'],
        password=creds['password'],
        connect_timeout=10
    )
    cur = conn.cursor()
    
    # 检查 PostgreSQL 版本
    cur.execute('SELECT version();')
    pg_version = cur.fetchone()[0]
    print(f"✅ PostgreSQL 连接成功")
    print(f"   版本: {pg_version.split(',')[0]}")
    
    # 检查 PostGIS 扩展（云数据库可能不支持）
    cur.execute("SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'postgis');")
    has_postgis = cur.fetchone()[0]
    
    if has_postgis:
        cur.execute('SELECT PostGIS_version();')
        postgis_version = cur.fetchone()[0]
        print(f"✅ PostGIS 扩展已安装")
        print(f"   版本: {postgis_version}")
    else:
        print(f"⚠️  PostGIS 扩展未安装")
        print(f"   注意: 云数据库（AWS RDS PostgreSQL 14）不支持安装自定义扩展")
        print(f"   PostGIS 功能不可用")
    
    # 检查数据库编码和时区
    cur.execute('SHOW server_encoding;')
    encoding = cur.fetchone()[0]
    cur.execute('SHOW timezone;')
    timezone = cur.fetchone()[0]
    print(f"   编码: {encoding}")
    print(f"   时区: {timezone}")
    
    # 检查当前连接数
    cur.execute('SELECT count(*) FROM pg_stat_activity;')
    connections = cur.fetchone()[0]
    print(f"   当前连接数: {connections}")
    
    # 生成 URL 编码的 DATABASE_URL
    password_encoded = urllib.parse.quote(creds['password'], safe='')
    database_url = f"postgresql+asyncpg://{creds['username']}:{password_encoded}@{creds['host']}:{creds['port']}/{creds['database']}"
    print("")
    print(f"📝 DATABASE_URL (已 URL 编码):")
    print(f"   {database_url}")
    
    cur.close()
    conn.close()
    print("")
    print("✅ 数据库状态检查完成 - 数据库就绪")
    sys.exit(0)
    
except psycopg2.OperationalError as e:
    print(f"❌ 数据库连接失败: {e}")
    print("")
    print("可能的原因:")
    print("  1. 网络连接问题（需要 VPN 或特定网络）")
    print("  2. AWS RDS 安全组未配置允许当前 IP")
    print("  3. 数据库实例未启动或不可用")
    print("  4. 防火墙阻止连接")
    print("")
    print("建议:")
    print("  - 检查网络连接")
    print("  - 联系管理员检查 AWS RDS 安全组配置")
    print("  - 确认数据库实例状态")
    sys.exit(1)
except Exception as e:
    print(f"❌ 错误: {e}")
    sys.exit(1)
PYTHON_SCRIPT

exit_code=$?
if [ $exit_code -eq 0 ]; then
    echo -e "${GREEN}✅ 数据库检查完成${NC}"
else
    echo -e "${RED}❌ 数据库检查失败${NC}"
    exit $exit_code
fi
