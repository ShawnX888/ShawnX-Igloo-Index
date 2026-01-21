# v2 文档-代码-环境冲突与问题清单（审计版）

**生成日期**：2026-01-20  
**范围**：对齐 `docs/v2/v2项目总览.md`、`docs/v2/v2实现步骤总览.md`、`docs/v2/v2技术方案.md`、`packages/v2-fullstack/Tool_Env_SETUP.md` 与  
`docs/v2/v2实施总结/`、代码库 `packages/v2-fullstack/` 的一致性。  

> 目标：把“会误导/会跑不起来/口径冲突”的点一次性列出来（含已确认的错误 `DATABASE_URL`），为后续修复提供 checklist。  

---

## 0. 当前环境基线（供读者快速建立上下文）

- **本地基础设施**：Docker Compose（`packages/v2-fullstack/docker-compose.yml`）提供：
  - PostgreSQL `14.7-alpine`，数据库 `igloo_index`，用户 `igloo`，**不包含 PostGIS**
  - Redis `7-alpine`
- **实际 DB 现状（容器内）**：需要以“检查时刻”为准（DB 可能随你执行迁移/建表/清库而变化）。  
  - 说明：本审计文档最初生成时，曾在 `igloo_index` 观察到 **没有用户表（空库）**（`\dt` 无 relations / `pg_tables` 为 0）。  
  - 备注：如果你当前的本机 Docker DB 已完成建表/迁移或已导入数据，请以最新的容器内查询结果为准，并将本条更新为“实际表清单/迁移状态”，避免误导。

---

## 1. P0（会直接导致跑不起来 / 跑偏 / 误连库）

### 1.1 Seed 脚本写死错误的 `DATABASE_URL`（已确认）

- **位置**：`packages/v2-fullstack/backend/app/seeds/seed_products.py`
- **问题**：硬编码为 `postgresql+asyncpg://user:password@localhost/igloo`，与本机 Docker DB（`igloo_index`）不一致，且会导致：
  - seed 连接失败，或
  - seed 落到错误数据库，进而误以为“表/数据已初始化”
- **证据**（关键片段）：

```77:88:/Users/zhushixie/Coding/ShawnX-Igloo-Index/packages/v2-fullstack/backend/app/seeds/seed_products.py
async def main():
    """主函数"""
    # TODO: 从环境变量读取数据库URL
    # DATABASE_URL = os.getenv("DATABASE_URL")
    DATABASE_URL = "postgresql+asyncpg://user:password@localhost/igloo"
    
    engine = create_async_engine(DATABASE_URL, echo=True)
    
    # 创建表
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
```

---

### 1.2 后端 FastAPI 没有挂载任何 v1 router（API 路由“写了但不会生效”）

- **位置**：`packages/v2-fullstack/backend/app/main.py`
- **问题**：当前 `main.py` 只提供 `/` 与 `/health`，没有 `include_router(...)`，导致：
  - 文档里提到的 `/api/v1/products`、`/api/v1/data-products` 等即使存在 router 文件，也不会暴露出去
- **证据**：仓库搜索 `include_router(` 在后端目录无匹配；且 `main.py` 内容仅包含根路由与健康检查。

---

### 1.3 数据库 Session 依赖为 501 占位：API 层“无法访问 DB”

- **位置**：
  - `packages/v2-fullstack/backend/app/api/v1/products.py`
  - `packages/v2-fullstack/backend/app/api/v1/data_products.py`
- **问题**：`get_session()` 直接抛 `501 Database not configured`（或 `not configured yet`），意味着：
  - 即便 router 被挂载，API 调用仍无法访问 DB
- **证据**（关键片段）：

```34:37:/Users/zhushixie/Coding/ShawnX-Igloo-Index/packages/v2-fullstack/backend/app/api/v1/data_products.py
async def get_session() -> AsyncSession:
    """获取数据库会话"""
    raise HTTPException(status_code=501, detail="Database not configured")
```

---

### 1.4 Data Products（L0/L1/Overlays）在代码中是 501 pending，但总结文档描述为“已完成框架/可调用”

- **位置**：`packages/v2-fullstack/backend/app/api/v1/data_products.py`
- **问题**：
  - `POST /l0-dashboard`、`/map-overlays`、`/l1-intelligence` 直接 `501 implementation pending`
  - 与 `docs/v2/v2实施总结/PHASE_1_COMPLETE_SUMMARY.md` 中“API 框架就绪/可并行开发”的描述存在落差（至少从“可运行调用”的角度）
- **证据**（关键片段）：

```39:80:/Users/zhushixie/Coding/ShawnX-Igloo-Index/packages/v2-fullstack/backend/app/api/v1/data_products.py
raise HTTPException(status_code=501, detail="L0 Dashboard implementation pending")
...
raise HTTPException(status_code=501, detail="Map Overlays implementation pending")
...
raise HTTPException(status_code=501, detail="L1 Intelligence implementation pending")
```

---

### 1.5 前端框架口径冲突：文档写 Next.js（App Router），实现为 Vite

- **文档口径**：
  - `docs/v2/v2项目总览.md`：系统架构写 Next.js（App Router）
- **代码事实**：
  - `packages/v2-fullstack/frontend/package.json`：`dev` 为 `vite`
- **影响**：
  - “App Router / Next.js”相关的目录结构、路由、部署与 SSR/CSR 假设会全部偏离
  - 读文档按 Next.js 配置会直接误操作

---

## 2. P1（会造成口径漂移 / 实现与文档互相误导）

### 2.1 PostGIS/PG15+ 的口径与“Docker PG14.7 无 PostGIS”冲突

- **环境文档口径（本机）**：`packages/v2-fullstack/Tool_Env_SETUP.md` 指定 `postgres:14.7-alpine` 且“不包含 PostGIS”
- **高层文档口径**：
  - `docs/v2/v2项目总览.md` 仍写 “PostgreSQL/PostGIS” 且 Data Layer 片段写 “PostgreSQL 15+ / PostGIS 3.3+”
  - `docs/v2/v2架构升级-全栈方案.md` 中也有 “PostgreSQL 15+ + PostGIS 3.3+”
- **代码依赖暗示**：`backend/requirements.txt` / `pyproject.toml` 包含 `geoalchemy2`
- **风险**：
  - 读者会误以为必须使用 PostGIS/几何类型
  - 与当前“无扩展”约束冲突（尤其在 DB schema 设计/查询/索引策略上）

---

### 2.2 Step 07 表名冲突：步骤总览写 `historical_weather_data`，模型实现为 `weather_data`

- **文档**：`docs/v2/v2实现步骤总览.md` Step 07 描述为 `historical_weather_data 表 + API`
- **实现**：`packages/v2-fullstack/backend/app/models/weather.py` 为 `__tablename__ = "weather_data"`
- **风险**：
  - 迁移/建表/SQL 查询/测试命名会出现两套口径

---

### 2.3 Celery/Redis 配置与 `env.example` 口径不一致（大量硬编码）

- **env 模板**：`packages/v2-fullstack/env.example` 用统一的 `REDIS_URL`、`CELERY_BROKER_URL`、`CELERY_RESULT_BACKEND`
- **代码现状**：
  - `packages/v2-fullstack/backend/app/celery_app.py` 写死 broker `redis://localhost:6379/0`、backend `redis://localhost:6379/1`
  - `packages/v2-fullstack/backend/app/tasks/risk_calculation.py` 与 `claim_calculation.py` 写死 redis host/port 且使用 `db=2` 做锁
- **风险**：
  - 环境变量看似配置正确但实际上不生效
  - 不同模块使用不同 Redis DB index，造成排障困难

---

### 2.4 实施进度文档自相矛盾（同文件内数字不一致）

- **位置**：`docs/v2/v2实施总结/PROGRESS_SUMMARY.md`
- **问题**：
  - 文件开头写 `23/47 (49%)`
  - 文件后部又写 `19/47 (40%)`
- **风险**：对外同步/里程碑判断失真，影响决策与协作。

---

### 2.5 依赖版本口径不一致（文档 vs requirements）

- **文档口径**：`packages/v2-fullstack/Tool_Env_SETUP.md` 中列出的版本（FastAPI/GeoAlchemy2/Redis/google-generativeai 等）
- **代码事实**：`packages/v2-fullstack/backend/requirements.txt` 中锁定版本不同
- **风险**：
  - 按文档安装会得到不同依赖图
  - 排查 bug 时“版本不同导致差异”难以定位

---

## 3. P2（代码质量/一致性问题，会导致后续返工）

### 3.1 `products.py` 路由文件存在明显导入缺失（运行时报错风险）

- **位置**：`packages/v2-fullstack/backend/app/api/v1/products.py`
- **问题**：使用了 `Optional[...]` 但未导入 `Optional`
- **风险**：模块导入阶段即失败，导致服务启动失败（或路由注册失败）。

---

## 4. 建议的对齐原则（不改代码，仅给“如何收敛口径”）

> 为避免再次出现“云数据库/本地 Docker 来回切换导致口径漂移”，建议明确 **单一真源** 与 **分层覆盖**：

- **真源建议**：
  - 运行环境与工具链：以 `packages/v2-fullstack/Tool_Env_SETUP.md` + `packages/v2-fullstack/docker-compose.yml` 为真源
  - 架构硬约束（如“无 PostGIS/无 DB 扩展”）：需写入 `docs/v2/v2项目总览.md` 与 `docs/v2/v2架构升级-全栈方案.md` 的顶层约束章节，避免不同文档各说各话
- **命名对齐**：
  - Step 07 表名（`historical_weather_data` vs `weather_data`）二选一，并在文档/代码/测试中全量统一
- **可运行闭环**：
  - 若文档宣称“API 框架完成”，最低要求应满足：router 已挂载、session 可用、端点不返回 501 占位（可用 mock 但需返回契约形状）

---

## 5. 参考索引（便于逐项修复定位）

- 环境文档：`packages/v2-fullstack/Tool_Env_SETUP.md`
- Compose：`packages/v2-fullstack/docker-compose.yml`
- 关键文档：
  - `docs/v2/v2项目总览.md`
  - `docs/v2/v2实现步骤总览.md`
  - `docs/v2/v2技术方案.md`
- 实施总结目录：`docs/v2/v2实施总结/`
- 代码目录：`packages/v2-fullstack/`

---

## 6. 修复跟踪记录表（建议作为本文件的“单一真源”）

> 用法建议：
> - **Status** 推荐取值：`todo` / `doing` / `blocked` / `done` / `wontfix`
> - **Last Updated**：每次变更后手动更新日期（YYYY-MM-DD）
> - **Notes**：记录“为什么这么改/关联 PR/验证方式/影响范围”

| ID | Severity | Item | Primary Files | Status | Owner | Last Updated | Notes |
|---:|:--:|---|---|:--:|---|:--:|---|
| 001 | P0 | Seed 脚本写死错误 `DATABASE_URL`（应从 env 读取，并指向 `igloo_index`） | `packages/v2-fullstack/backend/app/seeds/seed_products.py` | todo |  |  |  |
| 002 | P0 | FastAPI 未挂载 v1 routers（`include_router` 缺失） | `packages/v2-fullstack/backend/app/main.py` | todo |  |  |  |
| 003 | P0 | API DB Session 依赖为 501 占位（需实现 `get_session`） | `packages/v2-fullstack/backend/app/api/v1/products.py`, `.../data_products.py` | todo |  |  |  |
| 004 | P0 | L0/L1/Overlays 端点目前 501 pending（至少要返回契约形状或落地 mock） | `packages/v2-fullstack/backend/app/api/v1/data_products.py` | todo |  |  |  |
| 005 | P0 | 前端框架口径：文档 Next.js vs 实现 Vite（需统一口径或补充“当前实现”说明） | `docs/v2/v2项目总览.md`, `packages/v2-fullstack/frontend/*` | todo |  |  |  |
| 006 | P1 | PostGIS/PG15+ 口径 vs Docker PG14.7 无 PostGIS（需统一顶层约束） | `docs/v2/v2项目总览.md`, `docs/v2/v2架构升级-全栈方案.md`, `packages/v2-fullstack/Tool_Env_SETUP.md` | todo |  |  |  |
| 007 | P1 | Step 07 表名口径冲突（`historical_weather_data` vs `weather_data`） | `docs/v2/v2实现步骤总览.md`, `packages/v2-fullstack/backend/app/models/weather.py` | todo |  |  |  |
| 008 | P1 | Redis/Celery 配置与 env 模板不一致（大量硬编码 db index） | `packages/v2-fullstack/env.example`, `backend/app/celery_app.py`, `backend/app/tasks/*` | todo |  |  |  |
| 009 | P1 | `PROGRESS_SUMMARY.md` 进度数字自相矛盾（23/47 vs 19/47） | `docs/v2/v2实施总结/PROGRESS_SUMMARY.md` | todo |  |  |  |
| 010 | P1 | 依赖版本口径不一致（Tool_Env_SETUP vs requirements） | `packages/v2-fullstack/Tool_Env_SETUP.md`, `packages/v2-fullstack/backend/requirements.txt` | todo |  |  |  |
| 011 | P2 | `products.py` 缺少 `Optional` 导入（运行时报错风险） | `packages/v2-fullstack/backend/app/api/v1/products.py` | todo |  |  |  |

