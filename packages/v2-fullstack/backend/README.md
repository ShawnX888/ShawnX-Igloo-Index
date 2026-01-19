# Igloo Backend API

V2 全栈架构的后端 API 服务。

## 环境要求

- Python 3.10+ (当前使用 Python 3.13.5，conda 环境: Igloo-python=3.12)
- PostgreSQL 14+（云数据库 - AWS RDS）
  - ⚠️ **注意**：当前云数据库不支持 PostGIS 扩展，项目将不使用 PostGIS 功能
- Redis 7+（本地 Docker）

## 安装

### 使用 conda 环境（推荐）

```bash
# 激活 conda 环境（只使用 conda，不使用 venv）
conda activate Igloo-python=3.12

# 安装依赖（使用 pip）
pip install -r requirements.txt

# 或使用 poetry（推荐）
poetry install
```

## 环境变量配置

1. 复制环境变量模板：
   ```bash
   cp ../env.example .env
   ```

2. 编辑 `.env` 文件，确认配置项：
   - `DATABASE_URL` - 云数据库连接字符串（已自动配置）
   - `GOOGLE_MAPS_API_KEY`
   - `GOOGLE_GENERATIVE_AI_API_KEY`
   - 其他配置项

**数据库配置说明**：
- 数据库已迁移到云数据库（AWS RDS PostgreSQL 14）
- 连接信息从凭证文件自动读取：`~/Downloads/pg_credentials_next_gen_index_dev_20260119.json`
- 如需修改，运行：`./migrate-to-cloud-db.sh`

**⚠️ 重要**：`.env` 文件包含敏感信息，已添加到 `.gitignore`，不会提交到 Git 仓库。

## 运行

```bash
# 开发模式
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 或使用 poetry
poetry run uvicorn app.main:app --reload
```

## 项目结构

```
backend/
├── app/
│   ├── api/           # API 路由层
│   ├── services/      # 业务逻辑层
│   ├── compute/       # 计算引擎层
│   ├── agents/        # AI Agent 层
│   ├── tasks/         # Celery 任务
│   ├── models/        # 数据模型
│   └── utils/         # 工具函数
├── requirements.txt   # Python 依赖
├── pyproject.toml     # Poetry 配置
└── .env              # 环境变量（不提交到 Git）
```
