# Phase 0 - Step 04: 时间与时区口径统一 - 实施总结

**实施日期**: 2026-01-20  
**状态**: ✅ 已完成  
**实施者**: AI Agent (Claude)  
**依赖步骤**: Step 01 (Shared Contract基线)

---

## 实施概述

本步骤完成了v2时间三层口径的固化，确保全栈系统在时间处理上的一致性：

1. **存储/传输**: 统一UTC (DB TIMESTAMPTZ, API timestamps)
2. **业务边界**: region_timezone (自然日/月边界对齐)
3. **前端展示**: user local timezone (UI展示)
4. **扩展窗口**: 计算时可扩展，输出时裁剪
5. **时区工具**: UTC转换、自然边界对齐、同一天/月判断

---

## 交付物清单

### 后端 (Python)

| 文件路径 | 说明 | 行数 |
|---|---|---|
| `packages/v2-fullstack/backend/app/schemas/time.py` | 时间口径 Schema 定义 | 以代码为准 |
| `packages/v2-fullstack/backend/app/utils/time_utils.py` | 时区转换 + 自然边界对齐 + 扩展窗口计算工具 | 以代码为准 |
| `packages/v2-fullstack/backend/app/schemas/__init__.py` | 更新导出 | 已更新 |
| `packages/v2-fullstack/backend/tests/test_time_utils.py` | 验收测试（含关键业务规则） | 以代码为准 |

### 前端 (TypeScript)

| 文件路径 | 说明 | 行数 |
|---|---|---|
| `packages/v2-fullstack/frontend/src/types/time.ts` | 时间口径类型定义 | 以代码为准 |
| `packages/v2-fullstack/frontend/src/lib/time-utils.ts` | 时区转换 + 展示格式化工具 | 以代码为准 |
| `packages/v2-fullstack/frontend/src/types/index.ts` | 更新导出 | 已更新 |
| `packages/v2-fullstack/frontend/src/types/__tests__/time.test.ts` | 验收测试 | 以代码为准 |

---

## 验收标准完成情况

### 口径一致性（必须）✅

- [x] **同一筛选条件下，L0 KPI、L1时间轴汇总、L2事件摘要不互相矛盾（时间边界一致）**
  - 实现: 所有时间字段统一使用UTC
  - 工具: `align_to_natural_day_start()` 确保边界对齐
  - 测试: `test_natural_day_boundary_consistency`
  
- [x] **Timeline的三泳道（Weather/Risk/Claims）在同一UTC时间轴对齐**
  - 实现: `EventTimestamp.event_time_utc` 作为权威字段
  - 前端: 所有图表使用UTC时间戳作为x轴，展示时转换
  - (实际图表实现在Phase 2 Step 28)

### 时区边界（必须）✅

- [x] **"per day/per month"判断严格以 region_timezone 的自然日/月边界为准**
  - 实现: `is_same_natural_day()`, `is_same_natural_month()`
  - 业务规则测试: `test_per_day_boundary_at_region_midnight`
  - 关键: UTC同一天可能是region_tz的不同天
  
- [x] **跨日/月边界的事件能正确归期，并且解释可追溯（Meta中包含 region_timezone）**
  - 实现: `EventTimestamp.natural_date` 标注region_tz视角的日期
  - 测试: `test_same_natural_day_false_cross_midnight`
  - 边界案例: UTC 2025-01-20 20:00 = 北京时间 2025-01-21 04:00 (已跨日!)

---

## 核心功能验证

### 1. 时区三层口径 ✅

#### Layer 1: Storage & Transport (UTC)

```python
# 数据库
CREATE TABLE risk_events (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,  -- UTC
    ...
);

# API响应
{
    "event_time_utc": "2025-01-20T08:30:00Z",  -- UTC
    ...
}
```

#### Layer 2: Business Boundary (region_timezone)

```python
# 判断"once per day"的同一天
is_same_natural_day(
    utc_time1=datetime(2025, 1, 20, 8, 0, tzinfo=timezone.utc),
    utc_time2=datetime(2025, 1, 20, 14, 0, tzinfo=timezone.utc),
    region_timezone="Asia/Shanghai"
)
# → True (北京时间都是1月20日)

is_same_natural_day(
    utc_time1=datetime(2025, 1, 20, 8, 0, tzinfo=timezone.utc),
    utc_time2=datetime(2025, 1, 20, 20, 0, tzinfo=timezone.utc),
    region_timezone="Asia/Shanghai"
)
# → False (北京时间是20日 vs 21日)
```

#### Layer 3: Presentation (user local)

```typescript
// UI展示
formatUTCToLocal('2025-01-20T08:30:00Z', 'Asia/Shanghai')
// → "2025-01-20 16:30:00" (北京时间)

formatUTCToLocal('2025-01-20T08:30:00Z', 'America/New_York')
// → "2025-01-20 03:30:00" (纽约时间)
```

### 2. 自然边界对齐 ✅

#### 自然日起始对齐

```python
# UTC: 2025-01-20 08:30:00
# 北京时间: 2025-01-20 16:30:00 (下午4:30)

align_to_natural_day_start(
    datetime(2025, 1, 20, 8, 30, tzinfo=timezone.utc),
    "Asia/Shanghai"
)
# → 2025-01-19 16:00:00 UTC (北京时间1月20日 00:00:00)
```

#### 自然日结束对齐

```python
align_to_natural_day_end(
    datetime(2025, 1, 20, 8, 30, tzinfo=timezone.utc),
    "Asia/Shanghai"
)
# → 2025-01-20 15:59:59.999999 UTC (北京时间1月20日 23:59:59)
```

#### 自然月起始对齐

```python
# UTC: 2025-01-20 08:30:00
align_to_natural_month_start(
    datetime(2025, 1, 20, 8, 30, tzinfo=timezone.utc),
    "Asia/Shanghai"
)
# → 2024-12-31 16:00:00 UTC (北京时间2025-01-01 00:00:00)
```

### 3. 关键业务规则验证 ✅

#### "once per day" 的同一天判断

```python
# 场景: 保单说"once per day per policy"
# 问题: 这个"day"是指什么时区的day?
# 答案: 风险发生地(policy.region_timezone)的自然日

# 示例: 北京时间1月20日的两个事件
event1 = datetime(2025, 1, 20, 2, 0, tzinfo=timezone.utc)   # 北京10:00
event2 = datetime(2025, 1, 20, 14, 0, tzinfo=timezone.utc)  # 北京22:00

is_same_natural_day(event1, event2, "Asia/Shanghai")
# → True: 同一天，属于"同时期"，理赔计算需要考虑tier差额

# 但如果event2跨越了午夜...
event3 = datetime(2025, 1, 20, 20, 0, tzinfo=timezone.utc)  # 北京次日04:00

is_same_natural_day(event1, event3, "Asia/Shanghai")
# → False: 不同天，属于"新时期"，可以重新开始理赔计算
```

#### 跨时区一致性

```python
# 同一UTC时间在不同时区有不同的自然日归属
utc_time = datetime(2025, 1, 20, 2, 0, tzinfo=timezone.utc)

get_natural_date(utc_time, "Asia/Shanghai")
# → "2025-01-20" (北京时间1月20日)

get_natural_date(utc_time, "America/New_York")
# → "2025-01-19" (纽约时间1月19日)

# 说明: 保险业务必须使用 policy.region_timezone
```

### 4. 扩展窗口计算 ✅

```python
# 场景: 计算"过去7天累计降雨"
# 问题: 用户请求1月20日~1月27日的数据
# 答案: 需要从1月13日开始查询，才能计算1月20日的"过去7天"

time_range = TimeRangeUTC(
    start=datetime(2025, 1, 20, tzinfo=timezone.utc),
    end=datetime(2025, 1, 27, 23, 59, 59, tzinfo=timezone.utc),
    region_timezone="Asia/Shanghai"
)

calc_range = calculate_extended_range(
    time_range,
    TimeWindowType.DAILY,
    window_duration=7
)

# calculation_start: 2025-01-13 00:00:00 (提前7天)
# display_start: 2025-01-20 00:00:00 (用户请求)
# extension_hours: 168 (7天 = 168小时)

# 输出时必须裁剪回 display_start ~ display_end
```

---

## 测试覆盖

### 后端测试 (pytest)

| 测试类 | 测试用例数 | 覆盖内容 |
|---|---|---|
| `TestEnums` | 2 | 枚举值验证 |
| `TestTimezoneConversion` | 3 | UTC↔Region转换 |
| `TestNaturalBoundaryAlignment` | 4 | 自然日/月边界对齐 |
| `TestSameNaturalPeriod` | 4 | 同一天/月判断 |
| `TestExtendedRange` | 2 | 扩展窗口计算 |
| `TestEventTimestamp` | 1 | 事件时间戳创建 |
| `TestTimezoneForRegion` | 2 | 区域时区查询 |
| `TestTimeConsistency` | 1 | 时间口径一致性 |
| `TestCriticalBusinessRules` | 2 | ⭐ 关键业务规则 |
| `TestEdgeCases` | 2 | DST/闰秒边界 |
| **总计** | **23** | - |

### 前端测试 (Jest)

| 测试组 | 测试用例数 | 覆盖内容 |
|---|---|---|
| `Enums` | 2 | 枚举值验证 |
| `Time Range` | 5 | 时间范围创建/验证/计算 |
| `Display Formatting` | 5 | UTC→Local展示格式化 |
| `Time Range Presets` | 2 | 快捷时间范围 |
| `Timezone Utilities` | 3 | 时区查询/范围判断 |
| `UTC Conversion` | 2 | UTC转换 |
| **总计** | **19** | - |

---

## 关键设计决策

### 1. 三层口径严格分离

**决策**: Storage(UTC) / Business(region_tz) / Display(local) 三层不混用

**原因**:
- **Storage(UTC)**: 避免DST/时区变更导致数据混乱
- **Business(region_tz)**: 保险业务"per day"必须基于风险地时区
- **Display(local)**: 用户体验，但不影响业务逻辑

**反例(禁止)**:
```python
# ❌ 错误: 用本地时区做业务判断
if event_time.date() == datetime.now().date():  # 危险!
    # "同一天"取决于服务器/用户所在时区，会出错
```

**正确做法**:
```python
# ✅ 正确: 用region_timezone做业务判断
if is_same_natural_day(event_time_utc, ref_time_utc, policy.region_timezone):
    # "同一天"基于风险地区时区，准确可靠
```

### 2. `region_timezone` 为业务边界的唯一依据

**决策**: 所有"per day/month"判断必须提供 `region_timezone`

**原因**:
- 跨国/跨时区保单需求
- 避免"默认用UTC"导致业务错误
- 可审计和追溯

**实现**:
```python
# policy表必须包含 timezone 字段
class Policy(Base):
    timezone = Column(String(50), nullable=False)  # 如: "Asia/Shanghai"

# 理赔计算时使用
is_same_period = is_same_natural_day(
    event1_utc,
    event2_utc,
    policy.timezone  # ← 业务边界
)
```

### 3. 扩展窗口与输出裁剪分离

**决策**: 计算可扩展，但响应必须裁剪回用户请求的 `time_range`

**原因**:
- 保证窗口边界完整性 (如"过去7天累计"需要回溯7天数据)
- 避免返回用户不需要的数据
- 缓存可复用 (按calculation_range缓存，多个display_range共享)

**实现**:
```python
# 1. 计算扩展窗口
calc_range = calculate_extended_range(
    time_range,  # 用户请求: 1月20日~1月27日
    TimeWindowType.DAILY,
    window_duration=7  # 需要回溯7天
)
# calculation_start: 1月13日 (提前7天)

# 2. 查询数据 (使用calculation_range)
raw_data = query_weather_data(calc_range)

# 3. 计算风险事件 (使用完整数据)
risk_events = calculate_risk(raw_data)

# 4. 输出裁剪 (只返回display_range内的事件)
filtered_events = [
    evt for evt in risk_events
    if time_range.start <= evt.timestamp <= time_range.end
]
```

### 4. 前端只负责展示转换

**决策**: 前端不执行业务边界对齐，只做UTC→Local展示转换

**原因**:
- 业务逻辑在后端，避免前端实现错误
- 前端不知道policy.timezone，不应假设
- 降低前端复杂度

**实现**:
```typescript
// ✅ 正确: 只做展示转换
formatUTCToLocal(event.event_time_utc, event.region_timezone)

// ❌ 错误: 前端不做业务对齐
// if (isSameDayLocal(event1, event2)) { ... }  // 危险!
```

### 5. 时区映射表 (简化版)

**决策**: MVP使用静态映射表，未来可查询数据库

**原因**:
- 中国大陆基本都是东八区(除新疆/西藏)
- 避免过早引入复杂的地理服务
- 足够应对MVP场景

**实现**:
```python
CHINA_PROVINCE_TIMEZONES = {
    "CN-GD": "Asia/Shanghai",  # 广东
    "CN-BJ": "Asia/Shanghai",  # 北京
    "CN-XJ": "Asia/Urumqi",    # 新疆 (UTC+6)
    ...
}
```

---

## 关键业务规则实现

### 规则1: "per day" 基于风险地时区

```python
# 理赔计算引擎中
def calculate_claims(policy, risk_events):
    # 按自然日分组(使用policy的时区)
    events_by_day = {}
    
    for event in risk_events:
        natural_date = get_natural_date(event.timestamp, policy.timezone)
        if natural_date not in events_by_day:
            events_by_day[natural_date] = []
        events_by_day[natural_date].append(event)
    
    # 每个自然日内按tier差额计算
    for natural_date, day_events in events_by_day.items():
        claims = calculate_tier_differential(day_events, policy)
        ...
```

### 规则2: Timeline对齐

```python
# L1 Region Intelligence的Timeline三泳道
{
    "weather": {
        "timestamps": ["2025-01-20T00:00:00Z", "2025-01-20T01:00:00Z", ...],  # UTC
        "values": [10.5, 12.3, ...]
    },
    "risk": {
        "timestamps": ["2025-01-20T03:00:00Z", "2025-01-20T15:00:00Z"],  # UTC
        "events": [...]
    },
    "claims": {
        "timestamps": ["2025-01-20T03:30:00Z", "2025-01-20T15:30:00Z"],  # UTC
        "events": [...]
    },
    "legend": {
        "region_timezone": "Asia/Shanghai",  # 标注时区
        "alignment_applied": true,
        "time_window_type": "daily"
    }
}

# 前端渲染时，三泳道共用同一UTC时间轴
```

### 规则3: 扩展窗口说明

```python
# Meta中说明扩展窗口
{
    "calculation_range": {
        "calculation_start": "2025-01-13T00:00:00Z",
        "display_start": "2025-01-20T00:00:00Z",
        "extension_hours": 168
    },
    "timezone_alignment": {
        "region_timezone": "Asia/Shanghai",
        "alignment_applied": true,
        "alignment_details": "自然日边界对齐: 2025-01-20 00:00:00 CST → 2025-01-19 16:00:00 UTC"
    }
}
```

---

## 边界案例与测试

### 案例1: UTC跨日但region_tz同日

```
UTC: 2025-01-20 08:00 → 2025-01-20 14:00
北京: 2025-01-20 16:00 → 2025-01-20 22:00
判断: 同一天 ✓
```

### 案例2: UTC同日但region_tz跨日

```
UTC: 2025-01-20 08:00 → 2025-01-20 20:00
北京: 2025-01-20 16:00 → 2025-01-21 04:00
判断: 不同天 ✓ (已跨越北京时间午夜)
```

### 案例3: 跨月边界

```
UTC: 2025-01-31 20:00
北京: 2025-02-01 04:00
自然月: 2月 (按北京时间)
```

### 案例4: 夏令时切换 (美国)

```python
# 2025-03-09 是美国夏令时开始日
before_dst = datetime(2025, 3, 9, 6, 0, tzinfo=timezone.utc)
after_dst = datetime(2025, 3, 9, 8, 0, tzinfo=timezone.utc)

ny_before = utc_to_region_tz(before_dst, "America/New_York")
ny_after = utc_to_region_tz(after_dst, "America/New_York")

# 时区offset会从UTC-5变为UTC-4
# Python的zoneinfo会自动处理
```

---

## 可观测性实现

### 时间相关日志必带字段

```python
logger.info(
    "Risk event calculated",
    extra={
        "trace_id": trace_id,
        "event_time_utc": event.timestamp.isoformat(),
        "region_timezone": policy.timezone,
        "natural_date": get_natural_date(event.timestamp, policy.timezone),
        "time_range_utc_start": time_range.start.isoformat(),
        "time_range_utc_end": time_range.end.isoformat(),
        "calculation_range_extension_hours": calc_range.extension_hours,
    }
)
```

### 边界对齐日志

```python
logger.debug(
    "Natural boundary alignment applied",
    extra={
        "original_utc": time_range.start.isoformat(),
        "aligned_utc": aligned_start.isoformat(),
        "region_timezone": region_timezone,
        "natural_date": get_natural_date(aligned_start, region_timezone),
    }
)
```

---

## 前端UI展示建议

### 1. 时间范围选择器

```typescript
// 快捷按钮
<TimeRangeSelector>
  <button onClick={() => setTimeRange(TimeRangePresets.last7Days(regionTimezone))}>
    Last 7 Days
  </button>
  <button onClick={() => setTimeRange(TimeRangePresets.thisMonth(regionTimezone))}>
    This Month
  </button>
  
  {/* 自定义范围: 前端选择，发送UTC到后端 */}
  <DateRangePicker
    onChange={(start, end) => {
      setTimeRange(createTimeRange(start, end, regionTimezone));
    }}
  />
</TimeRangeSelector>
```

### 2. 事件时间展示

```typescript
// 展示事件时间
<EventCard event={event}>
  <div className="event-time">
    {/* 优先显示natural_datetime_display */}
    {event.natural_datetime_display || 
     formatUTCToLocal(event.event_time_utc, event.region_timezone)}
  </div>
  
  <div className="relative-time">
    {getRelativeTime(event.event_time_utc)}
  </div>
</EventCard>
```

### 3. Timeline时间轴

```typescript
// Timeline组件使用UTC时间戳
<TimelineChart
  xScale={{
    type: 'time',
    // ✅ 使用UTC时间戳
    domain: [parseUTC(timeRange.start), parseUTC(timeRange.end)],
  }}
  xAxis={{
    // ✅ 展示时转换为用户本地时区
    tickFormatter: (value) => {
      const utcTime = new Date(value).toISOString();
      return formatUTCToLocal(utcTime, regionTimezone, 'datetime');
    }
  }}
/>
```

### 4. 时区说明提示

```typescript
// 在Legend中显示时区说明
<Legend>
  {legend.timezone_alignment && (
    <div className="timezone-info">
      <InfoIcon />
      <span>Timezone: {legend.timezone_alignment.region_timezone}</span>
      {legend.timezone_alignment.alignment_details && (
        <Tooltip>{legend.timezone_alignment.alignment_details}</Tooltip>
      )}
    </div>
  )}
</Legend>
```

---

## 与其他步骤的集成

### 与 Step 01 (Shared Contract) 的集成 ✅

- `SharedDimensions.time_range` 使用 `TimeRange` (已在Step 01定义，可迁移到 `TimeRangeUTC`)
- `SharedDimensions.region_timezone` 已包含
- `EventData.timestamp` 统一使用UTC

### 与 Step 03 (Prediction Run) 的集成 ✅

- predicted事件的时间戳也是UTC
- 批次切换不影响时间口径
- 时间戳+批次ID共同确定事件唯一性

### 被 Phase 1 依赖

- **Step 06: 保单表**
  - `policies` 表必须包含 `timezone` 字段
  - 类型: VARCHAR(50), 如 "Asia/Shanghai"
  
- **Step 08: Risk Calculator**
  - 计算"per day"累计时使用 `align_to_natural_day_start()`
  - 扩展窗口计算使用 `calculate_extended_range()`
  
- **Step 09: 风险事件表**
  - `risk_events.timestamp` 使用 TIMESTAMPTZ (UTC)
  - 创建事件时使用 `create_event_timestamp()`
  
- **Step 31: Claim Calculator**
  - 判断"同时期"时使用 `is_same_natural_day()` / `is_same_natural_month()`
  - 必须使用 `policy.timezone`

---

## 后续步骤建议

### Phase 0 完成 ✅

- [x] ✅ Step 01: Shared Contract 基线
- [x] ✅ Step 02: Access Mode 裁剪基线
- [x] ✅ Step 03: Prediction Run 基线
- [x] ✅ Step 04: 时间与时区口径统一 (当前步骤)

**Phase 0 全部完成！可以进入 Phase 1 (后端数据产品)**

### Phase 1 立即可开工

Phase 0的契约已固化，以下步骤可以并行开工:

- **Step 05**: 产品表 + Product Service
- **Step 06**: 保单表 + Policy Service (需要包含 `timezone` 字段)
- **Step 07**: 天气数据表 + Weather Service

---

## 风险与注意事项

### ⚠️ 高风险项

1. **业务逻辑用错时区**
   - **风险**: 用UTC或用户本地时区做"per day"判断
   - **症状**: 跨时区保单理赔错误/重复理赔/漏赔
   - **缓解**: 
     - 强制使用 `is_same_natural_day(utc1, utc2, region_tz)`
     - 禁止直接用 `date1.date() == date2.date()`
     - 测试覆盖跨日边界场景

2. **前端执行业务对齐**
   - **风险**: 前端用本地时区做业务判断
   - **症状**: 不同用户看到不同的统计结果
   - **缓解**: 前端只负责展示，不承担业务对齐

3. **扩展窗口未裁剪**
   - **风险**: 返回了用户不需要的数据
   - **症状**: UI显示超出选择范围的数据，或缓存口径错
   - **缓解**: 输出前强制裁剪到 `display_range`

### ✅ 已实施的保障措施

1. **类型层时区字段**: `EventTimestamp.region_timezone` 强制提供
2. **完整测试覆盖**: 包含跨日/跨月/跨时区边界场景
3. **工具函数集中管理**: 禁止散落的时区转换代码
4. **可观测日志**: 记录时区对齐细节

---

## 参考文档

- `docs/v2/v2实施细则/04-时间与时区口径统一-细则.md`
- `docs/v2/v2复用逻辑摘录/RD-时间与时区口径统一.md`
- `docs/v2/v2复用逻辑摘录/RD-计算窗口与扩展数据.md`
- `docs/v2/v2架构升级-全栈方案.md` - Section 9.9 (时区处理)

---

## 验收签字

- [x] 三层时间口径定义完成 (UTC/region_tz/local)
- [x] 自然边界对齐工具实现完成
- [x] "per day/month"业务规则实现完成
- [x] 扩展窗口机制实现完成
- [x] 前后端工具函数完成
- [x] 测试覆盖达标 (42个测试用例)
- [x] 关键业务规则验证通过

**Go/No-Go**: ✅ **GO** - Phase 0 全部完成，可进入 Phase 1

---

**实施总结生成时间**: 2026-01-20  
**Phase 0 状态**: ✅ 全部完成 (4/4 步骤)  
**下一阶段**: Phase 1 - 后端数据产品最小可用 (Step 05-15)
