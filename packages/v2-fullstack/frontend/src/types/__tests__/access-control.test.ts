/**
 * 测试Access Mode裁剪基线的验收用例
 * 
 * Reference: docs/v2/v2实施细则/02-Access-Mode裁剪基线-细则.md
 * 
 * CRITICAL: 所有测试必须与后端 tests/test_access_control.py 保持对应
 */

import {
  AccessMode,
  PruningDimension,
  DataProductType,
  FieldPruningRule,
  GranularityPruningRule,
  CapabilityPruningRule,
  ModePruningPolicy,
  UnauthorizedAccessStrategy,
  UICapabilityState,
  isCapabilityAllowed,
  isFieldAllowed,
  getUICapabilityState,
  createDefaultUIConfig,
  filterObjectFields,
  shouldShowUpgradeHint,
} from '../access-control';

describe('Enums', () => {
  describe('PruningDimension', () => {
    it('should have correct values', () => {
      expect(PruningDimension.FIELD).toBe('field');
      expect(PruningDimension.GRANULARITY).toBe('granularity');
      expect(PruningDimension.CAPABILITY).toBe('capability');
    });
  });

  describe('DataProductType', () => {
    it('should have correct values', () => {
      expect(DataProductType.L0_DASHBOARD).toBe('l0_dashboard');
      expect(DataProductType.L1_REGION_INTELLIGENCE).toBe('l1_region_intelligence');
      expect(DataProductType.L2_EVIDENCE).toBe('l2_evidence');
      expect(DataProductType.MAP_OVERLAYS).toBe('map_overlays');
      expect(DataProductType.AI_INSIGHTS).toBe('ai_insights');
    });
  });

  describe('UnauthorizedAccessStrategy', () => {
    it('should have correct values', () => {
      expect(UnauthorizedAccessStrategy.PRUNE_AND_RETURN).toBe('prune_and_return');
      expect(UnauthorizedAccessStrategy.REJECT).toBe('reject');
    });
  });
});

describe('Pruning Rules', () => {
  describe('FieldPruningRule', () => {
    it('should filter allowed fields', () => {
      const rule: FieldPruningRule = {
        allowed_fields: new Set(['name', 'age']),
      };

      const policy: ModePruningPolicy = {
        mode: AccessMode.DEMO_PUBLIC,
        data_product: DataProductType.L0_DASHBOARD,
        field_pruning: rule,
        granularity_pruning: {
          allow_detail: false,
          force_aggregation: true,
        },
        capability_pruning: {
          allowed_capabilities: new Set(['view']),
        },
        default_disclosure: 'collapsed',
        policy_version: 'v1.0.0',
      };

      expect(isFieldAllowed('name', policy)).toBe(true);
      expect(isFieldAllowed('age', policy)).toBe(true);
      expect(isFieldAllowed('ssn', policy)).toBe(false);
    });
  });

  describe('CapabilityPruningRule', () => {
    it('should check capability allowlist', () => {
      const policy: ModePruningPolicy = {
        mode: AccessMode.DEMO_PUBLIC,
        data_product: DataProductType.L0_DASHBOARD,
        field_pruning: {
          allowed_fields: new Set(),
        },
        granularity_pruning: {
          allow_detail: false,
          force_aggregation: true,
        },
        capability_pruning: {
          allowed_capabilities: new Set(['view', 'refresh']),
        },
        default_disclosure: 'collapsed',
        policy_version: 'v1.0.0',
      };

      expect(isCapabilityAllowed('view', policy)).toBe(true);
      expect(isCapabilityAllowed('refresh', policy)).toBe(true);
      expect(isCapabilityAllowed('export', policy)).toBe(false);
      expect(isCapabilityAllowed('compare', policy)).toBe(false);
    });
  });
});

describe('UI Capability State', () => {
  const demoPolicy: ModePruningPolicy = {
    mode: AccessMode.DEMO_PUBLIC,
    data_product: DataProductType.L0_DASHBOARD,
    field_pruning: {
      allowed_fields: new Set(['region_code', 'policy_count']),
    },
    granularity_pruning: {
      allow_detail: false,
      force_aggregation: true,
    },
    capability_pruning: {
      allowed_capabilities: new Set(['view', 'refresh']),
    },
    default_disclosure: 'half',
    policy_version: 'v1.0.0',
  };

  describe('getUICapabilityState', () => {
    it('should return enabled state for allowed capability', () => {
      const state = getUICapabilityState('view', demoPolicy);

      expect(state.visible).toBe(true);
      expect(state.enabled).toBe(true);
      expect(state.disabled_reason).toBeUndefined();
    });

    it('should return disabled state for disallowed capability', () => {
      const state = getUICapabilityState('export', demoPolicy);

      expect(state.visible).toBe(true);  // "可见但不可用"
      expect(state.enabled).toBe(false);
      expect(state.disabled_reason).toBeDefined();
      expect(state.unlock_hint).toBeDefined();
    });
  });

  describe('shouldShowUpgradeHint', () => {
    it('should return true for disallowed capabilities', () => {
      expect(shouldShowUpgradeHint('export', demoPolicy)).toBe(true);
      expect(shouldShowUpgradeHint('compare', demoPolicy)).toBe(true);
    });

    it('should return false for allowed capabilities', () => {
      expect(shouldShowUpgradeHint('view', demoPolicy)).toBe(false);
      expect(shouldShowUpgradeHint('refresh', demoPolicy)).toBe(false);
    });
  });
});

describe('UI Config Creation', () => {
  const partnerPolicy: ModePruningPolicy = {
    mode: AccessMode.PARTNER,
    data_product: DataProductType.L1_REGION_INTELLIGENCE,
    field_pruning: {
      allowed_fields: new Set(['region_code', 'trend_data']),
    },
    granularity_pruning: {
      allow_detail: true,
      force_aggregation: false,
      aggregation_level: 'district',
    },
    capability_pruning: {
      allowed_capabilities: new Set(['view', 'refresh', 'compare']),
    },
    default_disclosure: 'half',
    policy_version: 'v1.0.0',
  };

  describe('createDefaultUIConfig', () => {
    it('should create UI config for Partner mode', () => {
      const config = createDefaultUIConfig(
        AccessMode.PARTNER,
        DataProductType.L1_REGION_INTELLIGENCE,
        partnerPolicy
      );

      expect(config.mode).toBe(AccessMode.PARTNER);
      expect(config.data_product).toBe(DataProductType.L1_REGION_INTELLIGENCE);
      expect(config.default_disclosure).toBe('half');
      expect(config.allowed_ui_capabilities).toBeDefined();

      // Partner允许compare
      expect(config.allowed_ui_capabilities['compare'].enabled).toBe(true);
      // Partner不允许export
      expect(config.allowed_ui_capabilities['export'].enabled).toBe(false);
    });

    it('should include warnings for Demo/Public mode', () => {
      const demoPolicy: ModePruningPolicy = {
        mode: AccessMode.DEMO_PUBLIC,
        data_product: DataProductType.L0_DASHBOARD,
        field_pruning: {
          allowed_fields: new Set(),
        },
        granularity_pruning: {
          allow_detail: false,
          force_aggregation: true,
        },
        capability_pruning: {
          allowed_capabilities: new Set(['view']),
        },
        default_disclosure: 'collapsed',
        policy_version: 'v1.0.0',
      };

      const config = createDefaultUIConfig(
        AccessMode.DEMO_PUBLIC,
        DataProductType.L0_DASHBOARD,
        demoPolicy
      );

      expect(config.warnings).toBeDefined();
      expect(config.warnings!.length).toBeGreaterThan(0);
    });
  });
});

describe('Field Filtering', () => {
  const policy: ModePruningPolicy = {
    mode: AccessMode.DEMO_PUBLIC,
    data_product: DataProductType.L0_DASHBOARD,
    field_pruning: {
      allowed_fields: new Set(['name', 'score']),
    },
    granularity_pruning: {
      allow_detail: false,
      force_aggregation: true,
    },
    capability_pruning: {
      allowed_capabilities: new Set(['view']),
    },
    default_disclosure: 'collapsed',
    policy_version: 'v1.0.0',
  };

  describe('filterObjectFields', () => {
    it('should filter object fields based on policy', () => {
      const data = {
        name: 'Alice',
        score: 95,
        email: 'alice@example.com',
        internal_id: 'abc123',
      };

      const filtered = filterObjectFields(data, policy);

      expect(filtered.name).toBe('Alice');
      expect(filtered.score).toBe(95);
      expect(filtered.email).toBeUndefined();
      expect(filtered.internal_id).toBeUndefined();
    });
  });
});
