/**
 * 测试Prediction Run基线的验收用例
 * 
 * Reference: docs/v2/v2实施细则/03-Prediction-Run基线-细则.md
 * 
 * CRITICAL: 所有测试必须与后端 tests/test_prediction_run.py 保持对应
 */

import {
  PredictionRunStatus,
  PredictionRunSource,
  PredictionRun,
  ActiveRunInfo,
  ActiveRunSwitchRequest,
  ActiveRunSwitchRecord,
  PredictionConsistencyCheck,
  generateRunId,
  validatePredictionRequest,
  checkPredictionConsistency,
  formatRunIdForDisplay,
  isRunStale,
} from '../prediction';

import {
  PredictionRunCollector,
  checkRunStatusWarnings,
  formatRunStatus,
  formatRunSource,
  getRunStatusColor,
} from '../../lib/prediction-run';

describe('Enums', () => {
  describe('PredictionRunStatus', () => {
    it('should have correct values', () => {
      expect(PredictionRunStatus.ACTIVE).toBe('active');
      expect(PredictionRunStatus.ARCHIVED).toBe('archived');
      expect(PredictionRunStatus.FAILED).toBe('failed');
      expect(PredictionRunStatus.PROCESSING).toBe('processing');
    });
  });

  describe('PredictionRunSource', () => {
    it('should have correct values', () => {
      expect(PredictionRunSource.EXTERNAL_SYNC).toBe('external_sync');
      expect(PredictionRunSource.MANUAL_BACKFILL).toBe('manual_backfill');
      expect(PredictionRunSource.SCHEDULED_RERUN).toBe('scheduled_rerun');
      expect(PredictionRunSource.ROLLBACK).toBe('rollback');
    });
  });
});

describe('PredictionRun', () => {
  const now = new Date().toISOString();

  it('should create valid prediction run', () => {
    const run: PredictionRun = {
      id: 'run-2025-01-20-001',
      status: PredictionRunStatus.ACTIVE,
      source: PredictionRunSource.EXTERNAL_SYNC,
      created_at: now,
      note: 'Initial prediction batch',
    };

    expect(run.id).toBe('run-2025-01-20-001');
    expect(run.status).toBe(PredictionRunStatus.ACTIVE);
  });

  it('should support scope dimensions', () => {
    const run: PredictionRun = {
      id: 'run-2025-01-20-002',
      status: PredictionRunStatus.ACTIVE,
      source: PredictionRunSource.SCHEDULED_RERUN,
      created_at: now,
      weather_type: 'rainfall',
      product_id: 'daily_rainfall',
    };

    expect(run.weather_type).toBe('rainfall');
    expect(run.product_id).toBe('daily_rainfall');
  });
});

describe('ActiveRunInfo', () => {
  const now = new Date().toISOString();

  it('should create active run info', () => {
    const info: ActiveRunInfo = {
      active_run_id: 'run-2025-01-20-001',
      generated_at: now,
      source: PredictionRunSource.EXTERNAL_SYNC,
      scope_description: '全局',
    };

    expect(info.active_run_id).toBe('run-2025-01-20-001');
    expect(info.source).toBe(PredictionRunSource.EXTERNAL_SYNC);
  });
});

describe('ActiveRunSwitch', () => {
  const now = new Date().toISOString();

  it('should create switch request', () => {
    const request: ActiveRunSwitchRequest = {
      new_active_run_id: 'run-2025-01-20-002',
      reason: 'Rollback to previous batch',
      operator: 'admin@example.com',
      scope: 'global',
    };

    expect(request.new_active_run_id).toBe('run-2025-01-20-002');
    expect(request.reason).toContain('Rollback');
  });

  it('should create switch record', () => {
    const record: ActiveRunSwitchRecord = {
      from_run_id: 'run-2025-01-20-001',
      to_run_id: 'run-2025-01-20-002',
      switched_at: now,
      reason: 'Rollback',
      operator: 'admin@example.com',
      scope: 'global',
      affected_cache_keys: 125,
    };

    expect(record.from_run_id).toBe('run-2025-01-20-001');
    expect(record.to_run_id).toBe('run-2025-01-20-002');
    expect(record.affected_cache_keys).toBe(125);
  });
});

describe('Prediction Consistency', () => {
  describe('checkPredictionConsistency', () => {
    it('should detect consistent batches', () => {
      const dataSources = {
        l0_dashboard: 'run-2025-01-20-001',
        map_overlays: 'run-2025-01-20-001',
        l1_intelligence: 'run-2025-01-20-001',
      };

      const check = checkPredictionConsistency(dataSources, 'run-2025-01-20-001');

      expect(check.consistent).toBe(true);
      expect(check.prediction_run_ids).toEqual(['run-2025-01-20-001']);
    });

    it('should detect mixed batches', () => {
      const dataSources = {
        l0_dashboard: 'run-2025-01-20-001',
        map_overlays: 'run-2025-01-20-002', // 不同批次!
        l1_intelligence: 'run-2025-01-20-001',
      };

      const check = checkPredictionConsistency(dataSources, 'run-2025-01-20-001');

      expect(check.consistent).toBe(false);
      expect(check.prediction_run_ids.length).toBe(2);
      expect(check.inconsistent_sources).toContain('map_overlays');
      expect(check.recommendation).toBeDefined();
    });

    it('should detect batch mismatch with active_run', () => {
      const dataSources = {
        l0_dashboard: 'run-2025-01-20-002',
        map_overlays: 'run-2025-01-20-002',
      };

      const check = checkPredictionConsistency(
        dataSources,
        'run-2025-01-20-001' // active_run是001，但数据是002
      );

      expect(check.consistent).toBe(false);
      expect(check.active_run_id).toBe('run-2025-01-20-001');
      expect(check.recommendation).toContain('mismatch');
    });

    it('should handle all historical data (no run_ids)', () => {
      const dataSources = {
        l0_dashboard: undefined,
        map_overlays: undefined,
        l1_intelligence: undefined,
      };

      const check = checkPredictionConsistency(dataSources);

      expect(check.consistent).toBe(true);
      expect(check.prediction_run_ids).toEqual([]);
    });
  });

  describe('PredictionRunCollector', () => {
    it('should collect and check consistency', () => {
      const collector = new PredictionRunCollector();
      collector.setExpectedRunId('run-2025-01-20-001');

      collector.record('l0_dashboard', 'run-2025-01-20-001');
      collector.record('map_overlays', 'run-2025-01-20-001');

      const check = collector.check();

      expect(check.consistent).toBe(true);
    });

    it('should detect inconsistency', () => {
      const collector = new PredictionRunCollector();
      collector.setExpectedRunId('run-2025-01-20-001');

      collector.record('l0_dashboard', 'run-2025-01-20-001');
      collector.record('map_overlays', 'run-2025-01-20-002'); // 不同!

      const check = collector.check();

      expect(check.consistent).toBe(false);
    });

    it('should reset collector', () => {
      const collector = new PredictionRunCollector();
      collector.record('l0_dashboard', 'run-2025-01-20-001');

      collector.reset();

      expect(collector.getAllRunIds()).toEqual([]);
    });
  });
});

describe('Utility Functions', () => {
  describe('generateRunId', () => {
    it('should generate valid run_id', () => {
      const runId = generateRunId();

      expect(runId).toMatch(/^run-\d{4}-\d{2}-\d{2}-\d{6}$/);
    });

    it('should generate consistent run_id for same timestamp', () => {
      const timestamp = new Date('2025-01-20T12:30:45Z');
      const runId = generateRunId(timestamp);

      expect(runId).toContain('2025-01-20');
    });
  });

  describe('validatePredictionRequest', () => {
    it('should accept valid predicted request', () => {
      const [valid, error] = validatePredictionRequest('predicted', 'run-2025-01-20-001');

      expect(valid).toBe(true);
      expect(error).toBeNull();
    });

    it('should reject predicted request without run_id', () => {
      const [valid, error] = validatePredictionRequest('predicted', undefined);

      expect(valid).toBe(false);
      expect(error).toContain('required');
    });

    it('should accept valid historical request', () => {
      const [valid, error] = validatePredictionRequest('historical', undefined);

      expect(valid).toBe(true);
      expect(error).toBeNull();
    });

    it('should reject historical request with run_id', () => {
      const [valid, error] = validatePredictionRequest('historical', 'run-2025-01-20-001');

      expect(valid).toBe(false);
      expect(error).toContain('must not');
    });
  });

  describe('formatRunIdForDisplay', () => {
    it('should format run_id for display', () => {
      const formatted = formatRunIdForDisplay('run-2025-01-20-001');

      expect(formatted).toBe('2025-01-20 (001)');
    });

    it('should handle invalid format', () => {
      const formatted = formatRunIdForDisplay('invalid-format');

      expect(formatted).toBe('invalid-format');
    });
  });

  describe('isRunStale', () => {
    const now = new Date();

    it('should detect stale run', () => {
      const oldDate = new Date(now.getTime() - 48 * 60 * 60 * 1000); // 48小时前
      const run: PredictionRun = {
        id: 'run-old',
        status: PredictionRunStatus.ACTIVE,
        source: PredictionRunSource.EXTERNAL_SYNC,
        created_at: oldDate.toISOString(),
      };

      expect(isRunStale(run, 24)).toBe(true);
    });

    it('should detect fresh run', () => {
      const recentDate = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2小时前
      const run: PredictionRun = {
        id: 'run-fresh',
        status: PredictionRunStatus.ACTIVE,
        source: PredictionRunSource.EXTERNAL_SYNC,
        created_at: recentDate.toISOString(),
      };

      expect(isRunStale(run, 24)).toBe(false);
    });
  });
});

describe('Run Status Warnings', () => {
  const now = new Date().toISOString();

  describe('checkRunStatusWarnings', () => {
    it('should warn for failed batch', () => {
      const run: PredictionRun = {
        id: 'run-2025-01-20-001',
        status: PredictionRunStatus.FAILED,
        source: PredictionRunSource.EXTERNAL_SYNC,
        created_at: now,
      };

      const warnings = checkRunStatusWarnings(run);

      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings.some(w => w.level === 'error')).toBe(true);
    });

    it('should warn for archived batch when active exists', () => {
      const run: PredictionRun = {
        id: 'run-2025-01-20-001',
        status: PredictionRunStatus.ARCHIVED,
        source: PredictionRunSource.EXTERNAL_SYNC,
        created_at: now,
      };

      const warnings = checkRunStatusWarnings(run, 'run-2025-01-20-002');

      expect(warnings.some(w => w.message.includes('archived'))).toBe(true);
    });

    it('should warn for stale active batch', () => {
      const oldDate = new Date(Date.now() - 72 * 60 * 60 * 1000); // 72小时前
      const run: PredictionRun = {
        id: 'run-old',
        status: PredictionRunStatus.ACTIVE,
        source: PredictionRunSource.EXTERNAL_SYNC,
        created_at: oldDate.toISOString(),
      };

      const warnings = checkRunStatusWarnings(run);

      expect(warnings.some(w => w.message.includes('48 hours old'))).toBe(true);
    });
  });

  describe('Format functions', () => {
    it('should format status', () => {
      expect(formatRunStatus(PredictionRunStatus.ACTIVE)).toBe('Active');
      expect(formatRunStatus(PredictionRunStatus.ARCHIVED)).toBe('Archived');
      expect(formatRunStatus(PredictionRunStatus.FAILED)).toBe('Failed');
    });

    it('should format source', () => {
      expect(formatRunSource(PredictionRunSource.EXTERNAL_SYNC)).toBe('External Sync');
      expect(formatRunSource(PredictionRunSource.ROLLBACK)).toBe('Rollback');
    });

    it('should provide status colors', () => {
      expect(getRunStatusColor(PredictionRunStatus.ACTIVE)).toContain('green');
      expect(getRunStatusColor(PredictionRunStatus.FAILED)).toContain('red');
      expect(getRunStatusColor(PredictionRunStatus.ARCHIVED)).toContain('gray');
    });
  });
});
