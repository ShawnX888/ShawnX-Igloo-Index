## 模块信息

- **模块名**: 地图模式与动画系统（2D/Vector + Camera Animation Orchestration）
- **Reuse Type**: R1（体验/结构复用，v2 口径固化）
- **Target Home**: FE（UI Orchestration + Map Stage）+ Shared Contract（动画与加载约束）+ BE（数据产品请求治理配合）
- **绑定验收锚点**: Perf-SLO / Observability / Compliance / UI Orchestration

---

## v1 输入材料（仅用于溯源，不得在 v2 文档中直接引用实现）

- `docs/v1/24-3D地图.md`
- `docs/v1/25-矢量地图动画切换.md`

---

## 可复用逻辑摘录（v1 语义，不拷贝实现）

### 1) 地图模式选择：2D ↔ Vector Map + 3D Buildings（同一 Map 实例）

- v1 明确放弃 Photorealistic 3D（`Map3DElement` / `maps3d`）：
  - 两个渲染引擎/实例（`Map` vs `Map3DElement`），图层迁移复杂；
  - 数据可视化场景“白模”更适合（减少纹理干扰）；
  - 复杂度与性能/成本更可控。
- v1 的“3D”定义为：在 Vector map 上通过 `tilt` / `heading` / `zoom` 实现 3D 视角与 3D Buildings。

### 2) 统一样式配置：不同 mapMode 下图层与地图参数统一管理

- 用集中配置管理：
  - map（zoom/tilt/heading/rotateControl）
  - boundary / heatmap / markers 的样式差异

### 3) 动画系统：分层（业务场景 → 策略 → 引擎 → Maps API）

- 业务场景：
  - 页面初始化飞入
  - 远距离地址切换（搜索/GPS）
  - 2D/3D 切换
- 引擎提供：
  - rAF/缓动/插值
  - 可中断、可取消、回调
- 核心约束（v1 强调）：**动画完成后才加载数据与图层**；动画期间禁用交互/暂停图层更新。

---

## v2 适配与落地约束（必须按 v2 统一语言表达）

### 0) 官方能力边界（必须按文档约束，不凭经验）

- **Vector map 与 WebGL 能力**：倾斜/旋转/增强相机控制属于 vector map 能力（文档：`vector-map` 与 `webgl`）。
  - `map.moveCamera()` 用于同时修改多个 camera 属性（文档：`vector-map#control-camera` / `webgl`）。
  - 可通过 `renderingType: RenderingType.VECTOR` 启用 vector 渲染（无需 mapId），且它会覆盖 mapId 的 rendering type 设置（文档：`vector-map` / `webgl`）。
- **Geometry library**：长距离插值/距离/heading 应使用 `google.maps.geometry.spherical.*`，并且该库不是默认加载，必须显式加载（文档：`geometry`）。
  - `spherical.interpolate()` 提供球面线性插值（Slerp），优先用于长距离 fly-to 的中心点插值（文档：`reference/geometry#spherical.interpolate`）。
- **Photorealistic 3D（3D Maps）**：`Map3DElement` 属于 3D Maps（`maps3d`）体系，与 `google.maps.Map` 不同（文档：`reference/3d-map`）。

参考文档（建议在实施细则里固定为“权威链接”）：

- `https://developers.google.com/maps/documentation/javascript/vector-map?utm_source=gmp-code-assist`
- `https://developers.google.com/maps/documentation/javascript/webgl?utm_source=gmp-code-assist`
- `https://developers.google.com/maps/documentation/javascript/geometry?utm_source=gmp-code-assist`
- `https://developers.google.com/maps/documentation/javascript/reference/geometry?utm_source=gmp-code-assist`
- `https://developers.google.com/maps/documentation/javascript/reference/3d-map?utm_source=gmp-code-assist`

### 1) v2 的“地图模式”边界（强制）

- v2 默认只支持：
  - **2D（Raster 或 Vector 俯视）**
  - **Vector + 3D Buildings（同一 Map 实例）**
- v2 明确不做：
  - Photorealistic 3D（`Map3DElement`）的“与现有图层共存式切换”（除非未来专门立项且接受双引擎/双图层适配成本）。

### 2) Map ID / 渲染类型策略（必须可解释）

- 若要使用 vector + 3D Buildings，需要确保地图处于 vector 渲染：
  - 可用 `renderingType: VECTOR`（无需 mapId）启用 vector（官方说明其可覆盖 mapId rendering type）。
  - 若使用 mapId：必须确保 mapId 对应的 Map type 为 JavaScript 且是 Vector，并按需启用 Tilt/Rotation（官方 vector map 文档提到通过 mapId 启用 tilt/rotation 的配置路径）。
- **关键风险**：mapId 与渲染类型/能力不匹配时，会导致能力不可用或回退行为，必须在可观测性中明确记录 `getRenderingType()` 与 map capabilities（若使用）。

### 3) Camera 更新策略（v2 强制）

- 对“需要原子化更新多个相机参数”的场景（模式切换、飞入、远距离 fly-to）：
  - 优先使用 `moveCamera()` 作为“原子更新点”（官方：`moveCamera` 同时修改多个 camera properties）。
- 需要平滑过渡/动画时：
  - v2 的动画系统负责插值与节奏（rAF/缓动），而不是把动画逻辑散落在各处。
- 注意：`moveCamera()` 本身是“立即设置，无动画”的能力（文档：Map 方法说明）。动画需由上层驱动。

### 4) 动画期间的数据加载与 UI 红线（v2 强制）

将 v1 的“动画完成后加载”升级为 v2 的系统红线：

- **动画期间禁止**：
  - 触发新的 L1/L2 重请求（除非是后台预取且不触发渲染）；
  - 频繁图层重绘导致掉帧；
  - 用户交互（drag/zoom）与动画并发（必须有 `isAnimating` gate）。
- **允许并行**：
  - 后端数据产品的预取（但结果必须在动画完成后统一提交到渲染层）。
- **完成回调**：
  - 动画完成后，才允许把“新区域/新模式”的数据提交给 Map Stage 与 panels。

> 这条红线是为了保护“地图主舞台优先级”，与 `RD-性能优化.md` 的 hover/高频交互红线一致。

### 5) 可中断与竞态治理（v2 强制）

- 任意动画都必须可取消（用户连续搜索/GPS/切模式）。
- 取消时必须同步取消/废弃：
  - 旧的视角动画
  - 旧的并行数据准备结果（避免动画结束后“旧数据回写”）
- 同一时刻只能有一个“主动画”占用 map camera；其余请求必须排队或被合并（UI Orchestration 负责）。

### 6) 无障碍与降级（v2 必须）

- 尊重 `prefers-reduced-motion`：允许关闭动画或改为快速过渡。
- 低性能设备/3D 不可用时：
  - 必须降级到 2D（或 vector 俯视），并有可观测记录 `map_mode_degraded=true`。

### 7) 观测与验收（必须）

必须有事件链路可追溯：

- `map_mode_change_requested` → `map_animation_start` → `map_animation_end` → `dp_refresh_commit` → `ui_render_done`

必带字段：

- `trace_id/correlation_id`
- `map_mode_from/to`
- `rendering_type`
- `duration_ms`
- `cancelled`（true/false）
- `region_code`（若与区域切换绑定）

---

## 关联模块（约束落点）

- **强约束**：`RD-地图主舞台.md`（地图生命周期与交互优先级）
- **强约束**：`RD-性能优化.md`（动画/高频交互红线与降级）
- **强约束**：`RD-行政区域边界与选区交互.md`、`RD-GPS定位与反向地理编码.md`（区域切换触发动画与数据刷新）

---

## 验收标准（Go/No-Go）

- **模式切换**：
  - 2D ↔ Vector 3D Buildings 切换不引起图层丢失/重建风暴；
  - 切换期间交互被正确 gate，结束后恢复。
- **动画与数据一致性**：
  - 动画期间不发生“旧数据回写覆盖新状态”的竞态；
  - 动画完成后一次性提交渲染，避免闪烁。
- **降级可用**：
  - reduced-motion 与低性能设备策略生效且可观测。

---

## 反例（必须禁止）

- **反例 1**：区域切换时边动画边不断刷新图层/发请求，导致掉帧与状态撕裂。
- **反例 2**：未实现可取消，用户连续操作后出现“最终停在 A 区域但显示 B 数据”。
- **反例 3**：混入 `Map3DElement`（Photorealistic 3D）且试图复用现有图层，无适配层与双实例治理。

