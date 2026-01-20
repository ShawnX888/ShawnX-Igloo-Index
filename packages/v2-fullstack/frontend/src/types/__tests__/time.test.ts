/**
 * 测试时间与时区口径统一的验收用例
 * 
 * Reference: docs/v2/v2实施细则/04-时间与时区口径统一-细则.md
 * 
 * CRITICAL: 所有测试必须与后端 tests/test_time_utils.py 保持对应
 */

import {
  TimeWindowType,
  TimeGranularity,
  TimeRangeUTC,
  CalculationRangeUTC,
  EventTimestamp,
  TimezoneAlignmentMeta,
} from '../time';

import {
  formatUTCToLocal,
  toUTC,
  parseUTC,
  calculateDurationHours,
  calculateDurationDays,
  validateTimeRange,
  createTimeRange,
  formatEventTimestamp,
  formatTimeRange,
  getRelativeTime,
  TimeRangePresets,
  getTimezoneForRegion,
  isTimeInRange,
} from '../../lib/time-utils';

describe('Enums', () => {
  describe('TimeWindowType', () => {
    it('should have correct values', () => {
      expect(TimeWindowType.HOURLY).toBe('hourly');
      expect(TimeWindowType.DAILY).toBe('daily');
      expect(TimeWindowType.WEEKLY).toBe('weekly');
      expect(TimeWindowType.MONTHLY).toBe('monthly');
    });
  });

  describe('TimeGranularity', () => {
    it('should have correct values', () => {
      expect(TimeGranularity.HOUR).toBe('hour');
      expect(TimeGranularity.DAY).toBe('day');
      expect(TimeGranularity.WEEK).toBe('week');
      expect(TimeGranularity.MONTH).toBe('month');
    });
  });
});

describe('Time Range', () => {
  describe('createTimeRange', () => {
    it('should create valid time range', () => {
      const start = new Date('2025-01-01T00:00:00Z');
      const end = new Date('2025-01-31T23:59:59Z');

      const timeRange = createTimeRange(start, end, 'Asia/Shanghai');

      expect(timeRange.start).toBe(start.toISOString());
      expect(timeRange.end).toBe(end.toISOString());
      expect(timeRange.region_timezone).toBe('Asia/Shanghai');
    });
  });

  describe('validateTimeRange', () => {
    it('should accept valid time range', () => {
      const timeRange: TimeRangeUTC = {
        start: '2025-01-01T00:00:00Z',
        end: '2025-01-31T23:59:59Z',
      };

      const [valid, error] = validateTimeRange(timeRange);

      expect(valid).toBe(true);
      expect(error).toBeNull();
    });

    it('should reject invalid time range (end before start)', () => {
      const timeRange: TimeRangeUTC = {
        start: '2025-01-31T00:00:00Z',
        end: '2025-01-01T00:00:00Z',
      };

      const [valid, error] = validateTimeRange(timeRange);

      expect(valid).toBe(false);
      expect(error).toContain('after start');
    });
  });

  describe('calculateDuration', () => {
    it('should calculate duration in hours', () => {
      const timeRange: TimeRangeUTC = {
        start: '2025-01-01T00:00:00Z',
        end: '2025-01-01T12:00:00Z',
      };

      const hours = calculateDurationHours(timeRange);

      expect(hours).toBe(12);
    });

    it('should calculate duration in days', () => {
      const timeRange: TimeRangeUTC = {
        start: '2025-01-01T00:00:00Z',
        end: '2025-01-08T00:00:00Z',
      };

      const days = calculateDurationDays(timeRange);

      expect(days).toBe(7);
    });
  });
});

describe('Display Formatting', () => {
  describe('formatUTCToLocal', () => {
    it('should format UTC to local datetime', () => {
      const utcTime = '2025-01-20T08:30:00Z';

      const formatted = formatUTCToLocal(utcTime, 'Asia/Shanghai', 'datetime');

      // 应该包含日期和时间
      expect(formatted).toBeTruthy();
    });

    it('should format UTC to local date only', () => {
      const utcTime = '2025-01-20T08:30:00Z';

      const formatted = formatUTCToLocal(utcTime, 'Asia/Shanghai', 'date');

      // 应该只包含日期
      expect(formatted).toBeTruthy();
    });
  });

  describe('formatEventTimestamp', () => {
    it('should format event timestamp', () => {
      const eventTime: EventTimestamp = {
        event_time_utc: '2025-01-20T08:30:00Z',
        region_timezone: 'Asia/Shanghai',
        natural_date: '2025-01-20',
        natural_datetime_display: '2025-01-20 16:30:00 CST',
      };

      const formatted = formatEventTimestamp(eventTime, true);

      expect(formatted).toContain('2025-01-20');
      expect(formatted).toContain('CST');
    });
  });

  describe('formatTimeRange', () => {
    it('should format time range in short format', () => {
      const timeRange: TimeRangeUTC = {
        start: '2025-01-01T00:00:00Z',
        end: '2025-01-31T23:59:59Z',
      };

      const formatted = formatTimeRange(timeRange, 'short');

      expect(formatted).toBeTruthy();
      expect(formatted).toContain('-');
    });
  });

  describe('getRelativeTime', () => {
    it('should return relative time for past', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const relative = getRelativeTime(twoHoursAgo.toISOString());

      expect(relative).toContain('hours ago');
    });

    it('should return relative time for future', () => {
      const threeDaysLater = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      const relative = getRelativeTime(threeDaysLater.toISOString());

      expect(relative).toContain('in');
      expect(relative).toContain('days');
    });
  });
});

describe('Time Range Presets', () => {
  describe('last7Days', () => {
    it('should create last 7 days range', () => {
      const timeRange = TimeRangePresets.last7Days('Asia/Shanghai');

      const duration = calculateDurationDays(timeRange);

      expect(duration).toBeCloseTo(7, 1);
      expect(timeRange.region_timezone).toBe('Asia/Shanghai');
    });
  });

  describe('thisMonth', () => {
    it('should create current month range', () => {
      const timeRange = TimeRangePresets.thisMonth('Asia/Shanghai');

      const start = parseUTC(timeRange.start);
      const end = parseUTC(timeRange.end);

      // 应该是当月1号到月末
      expect(start.getDate()).toBe(1);
      expect(start.getMonth()).toBe(end.getMonth());
    });
  });
});

describe('Timezone Utilities', () => {
  describe('getTimezoneForRegion', () => {
    it('should return timezone for known region', () => {
      expect(getTimezoneForRegion('CN-GD')).toBe('Asia/Shanghai');
      expect(getTimezoneForRegion('CN-XJ')).toBe('Asia/Urumqi');
    });

    it('should return default timezone for unknown region', () => {
      const timezone = getTimezoneForRegion('CN-UNKNOWN');

      expect(timezone).toBe('Asia/Shanghai');
    });
  });

  describe('isTimeInRange', () => {
    it('should check if time is in range', () => {
      const timeRange: TimeRangeUTC = {
        start: '2025-01-01T00:00:00Z',
        end: '2025-01-31T23:59:59Z',
      };

      expect(isTimeInRange('2025-01-15T12:00:00Z', timeRange)).toBe(true);
      expect(isTimeInRange('2024-12-31T23:59:59Z', timeRange)).toBe(false);
      expect(isTimeInRange('2025-02-01T00:00:00Z', timeRange)).toBe(false);
    });
  });
});

describe('UTC Conversion', () => {
  describe('toUTC', () => {
    it('should convert local date to UTC ISO string', () => {
      const localDate = new Date('2025-01-20T12:30:00');
      const utcString = toUTC(localDate);

      expect(utcString).toMatch(/Z$/);
      expect(utcString).toContain('2025-01-20');
    });
  });

  describe('parseUTC', () => {
    it('should parse UTC ISO string to Date', () => {
      const utcString = '2025-01-20T12:30:00Z';
      const date = parseUTC(utcString);

      expect(date).toBeInstanceOf(Date);
      expect(date.toISOString()).toBe(utcString);
    });
  });
});
