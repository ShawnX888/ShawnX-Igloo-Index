# 44 - Mode 默认值 / 审计 / 回滚（配置治理）- v2 实施细则

> 对应 `docs/v2/v2实现步骤总览.md` Step 44  
> 状态：Draft（可开工）  
> 版本：v2.0  
> 创建日期：2026-01-19  
> 最后更新：2026-01-19

---

## 模块名称

Mode 治理（Access Mode Defaulting + Source of Truth + Audit + Rollback）：把 Access Mode 从“运行时随便切换的 UI 选项”升级为可审计的配置系统，避免权限旁路与口径漂移

---

## 目标 / 非目标

### 目标

- 固化 Access Mode 的 **默认值、来源与传播**：
  - 默认 Mode 的规则固定（例如 Demo/Public 作为默认）
  - Mode 的来源必须可审计（config/token/admin action）
  - Mode 不允许由客户端任意指定（防篡改）
- 固化“Mode 策略版本化”：
  - `mode_policy_version` 可回滚（快速切回更保守的裁剪与能力矩阵）
- 固化“切换与回滚审计”：
  - 谁/何时/为何/影响范围（至少记录到后端审计日志）
- 与 v2 三条红线对齐：
  - **权限旁路**：后端强裁剪 + 审计兜底；前端隐藏不算权限
  - **predicted 混批次**：Mode 不改变批次规则，但 Mode 切换必须不造成缓存串数据
  - **交互风暴**：Mode 切换是高影响操作，必须节流并明确触发的数据产品刷新范围

### 非目标

- 不引入重型 IAM（租户/组织/角色/细粒度 ACL）作为 MVP 前置条件。
- 不在本细则规定具体认证方案（JWT/session/static token），只定义：**Mode 不可被未授权客户端篡改** 与 **必须可审计**。

---

## 关联的数据产品（Data Product）

Mode 治理影响所有数据产品与 AI 输出：

- L0/L1/L2/Overlays（字段/粒度/能力裁剪，见 Step 02）
- AI Insights / Chat（输出内容与 CTA，见 Step 37/39/40/41）

---

## 输入维度（最小集合）

> Mode 治理的输入主要是“配置与审计字段”，业务维度沿用 Shared Contract。

### 配置输入（建议）

- `default_access_mode`（建议：`demo_public`）
- `mode_policy_version`（裁剪策略版本）
- `capability_policy_version`（能力矩阵版本，可与 mode_policy_version 合并）
- `mode_change_allowed`（是否允许在当前环境手动切换；例如 prod 禁止随意切）

### 请求/上下文字段（必须）

- `access_mode`
- `mode_source`（必填）：`server_default` | `token_claim` | `admin_override` | `env_config`
- `mode_policy_version`（必填）
- `trace_id/correlation_id`
- `actor`（审计必填）：`user_id`（若有）/`service_account`/`system_task`

---

## 输出形态

### 1) Mode Profile（建议对前端暴露一个只读配置）

- `access_mode`
- `capability_flags`（能力矩阵快照：Details/Compare/Export…）
- `mode_policy_version`
- `capability_policy_version`
- `source`（mode_source）

> 说明：前端以 Mode Profile 作为 Access State 的唯一事实来源；前端不得自行“提升 Mode”。

### 2) 审计事件输出（必须）

- `mode_profile_loaded`
- `mode_override_requested`
- `mode_override_applied`
- `mode_override_rejected`
- `mode_policy_version_changed`
- `capability_policy_version_changed`

---

## Mode 规则（必须写）

### 1) 默认值策略（强制）

- 未认证/公开访问：默认 `Demo/Public`
- 认证但无显式授权信息：默认 `Partner`（如业务需要）或仍为 `Demo/Public`（更安全，推荐）
- Admin/Internal：必须由后端明确赋权（token claim / server config），不得由客户端声明

### 2) 来源优先级（强制，防篡改）

推荐优先级（从高到低）：

1. `token_claim`（后端验证签名后提取）
2. `admin_override`（仅限受保护的内部接口；必须审计）
3. `env_config`（环境默认/部署配置）
4. `server_default`

硬规则：

- 禁止把 Mode 作为“可被客户端自由提交的 query/body 字段”直接信任。
- 前端最多只能提交 `requested_mode` 作为“申请”，最终 mode 以服务端决策为准（并记录 `mode_override_rejected`）。

---

## predicted 规则（必须写）

- Mode 切换不得影响 predicted 的批次一致性规则（run_id 仍必须全链路携带）。
- Mode 切换必须避免缓存串数据：
  - 所有 dp 缓存 key 必含 `access_mode`（Step 01/02）
  - 切换 Mode 后应触发相关 Query key 的失效/重取（前端 Query 层处理）

---

## 性能与缓存策略

### 刷新范围（建议门槛化）

Mode 变化属于“口径变化”，必须触发：

- L0/L1/Overlays：全部失效并重取（因为字段/粒度可能变化）
- L2：若当前打开，必须重取或降级（Demo 默认摘要/隐藏）
- AI：洞察卡与聊天建议需刷新（避免“Demo 说了 Admin 口径”）

### 防风暴（强制）

- Mode 切换必须节流：
  - 频繁切换只能“最后一次 wins”
  - in-flight 请求取消（Query 层）
- 动画期间（`is_animating=true`）：
  - 允许 UI 先更新 Mode 提示，但数据产品请求 commit 必须延后（与 Step 18/RD-地图模式与动画系统 对齐）

---

## 可观测性

必带字段（最小集合）：

- `trace_id/correlation_id`
- `access_mode`
- `mode_source`
- `mode_policy_version`
- `capability_policy_version`
- `actor`

关键审计点（必须）：

- Mode 决策（load）
- Mode 变更申请/拒绝/生效
- 策略版本（policy_version）变更与回滚

---

## 复用声明（必须写清楚）

### Reuse Digest（必填引用）

- `docs/v2/v2复用逻辑摘录/RD-分层职责与协作边界.md`（后端强裁剪 + 审计）
- `docs/v2/v2复用逻辑摘录/RD-性能优化.md`（节流/风暴治理）

### 依赖实施细则（强制对齐）

- `docs/v2/v2实施细则/02-Access-Mode裁剪基线-细则.md`（裁剪矩阵、mode_policy_version 字段）
- `docs/v2/v2实施细则/43-可观测性基础设施-细则.md`（事件命名、trace/correlation 规范、审计清单）
- `docs/v2/v2实施细则/03-Prediction-Run基线-细则.md`（缓存维度与 run_id 规则）

---

## 验收用例（可勾选）

### 安全（必须）

- [ ] Mode 不可被客户端篡改：客户端提交的 `requested_mode` 不会直接生效，后端会验证并记录审计事件。
- [ ] Demo/Public 默认值生效；未认证请求无法提升到 Admin/Internal。

### 审计（必须）

- [ ] Mode Profile 加载与变更（含拒绝）均可审计：who/when/why。
- [ ] mode_policy_version 可回滚，并有审计记录。

### 一致性（必须）

- [ ] Mode 切换后 L0/L1/L2/Overlays 与 AI 输出口径一致（无“UI 切了 Demo，但 AI/DP 仍按 Admin 输出”）。

---

## 两个“最常见失败模式”（必须写进每个模块）

### 失败模式 A：前端隐藏当权限

症状：前端通过本地开关“切到 Admin”，后端仍照常返回敏感字段，导致越权泄露。  
硬规则：Mode 只能由后端决策并裁剪；所有 Mode 变更必须审计；前端隐藏不算权限。

### 失败模式 B：predicted 混批次

症状：Mode 切换触发缓存串数据（未带 access_mode/run_id），导致看似“切了 Mode”但数据来自旧口径/旧批次。  
硬规则：cache key 必含 `access_mode`；predicted 必含 `prediction_run_id`；切换必须失效重取。

---

## 风险与回滚策略

### 风险

- Mode 来源不收敛导致“同一环境多个默认值”与口径漂移（P0/P1）。
- 变更无审计导致无法证明未越权（P0）。

### 回滚策略

- 一键回滚到更保守的 `mode_policy_version`（优先保护 Demo/Public）。
- 若发现疑似越权：立即强制所有未认证流量锁定 Demo/Public，并收紧 capability_flags（禁用 L2/export）。

