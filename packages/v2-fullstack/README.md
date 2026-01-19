# V2 Fullstack - Index Insurance Portal

## 项目概述

这是 Index Insurance Portal 的 V2 全栈版本，基于 Next.js App Router 构建。

## 技术栈

### Frontend
- **Next.js 14+** (App Router)
- **React 19**
- **TypeScript**
- **Tailwind CSS**

### Backend
- **API Routes** (Next.js API Routes)
- **数据库** (待定)

### Shared
- 共享类型定义
- 共享工具函数

## 项目结构

```
packages/v2-fullstack/
├── frontend/          # Next.js 前端应用
├── backend/           # API 服务（可选独立服务）
└── shared/            # 共享代码
```

## 开发指南

详细文档请参考：[docs/v2/文档索引.md](../../docs/v2/文档索引.md)

## 快速开始

```bash
# 启动基础设施（Postgres + Redis）
cd packages/v2-fullstack
npm run dev:help
npm run dev:infra

# 启动后端（FastAPI / Uvicorn，热更新）
npm run dev:backend

# 启动前端（Vite）
npm run dev:frontend

# 一键启动：infra + backend + frontend（推荐）
npm run dev:full
```

## 常用命令

```bash
# 环境自检（Docker / compose / 目录结构 / env 文件）
cd packages/v2-fullstack
npm run dev:doctor

# 等待 infra 健康（适合脚本化/CI/避免后端先起连不上 DB）
npm run dev:infra:wait

# 查看 docker 服务状态与日志
npm run dev:infra:ps
npm run dev:infra:logs

# 停止 docker 服务（保留数据卷）
npm run dev:infra:down

# 危险：清空本地 docker 卷数据（需要显式确认）
I_AM_SURE=1 npm run dev:infra:reset

# 进入容器（排查 DB / Redis 很常用）
npm run dev:psql
npm run dev:redis-cli

# Celery（Step 14/15/32 落地后启用）
npm run dev:worker
npm run dev:beat
npm run dev:full:worker

# DB 迁移（Step 05+ 落地 Alembic 后启用）
npm run dev:migrate
IGLOO_MIGRATION_MSG="add policies table" npm run dev:makemigrations

# 自动配置开发工具连接（DBeaver/Postman/RedisInsight）
npm run dev:tools
```
