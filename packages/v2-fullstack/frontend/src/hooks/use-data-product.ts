/**
 * Data Product Hooks
 * 
 * 职责: 封装数据产品查询逻辑
 * 
 * Reference:
 * - docs/v2/v2实施细则/16-前端项目结构与类型定义-细则.md
 * 
 * 硬规则:
 * - 使用TanStack Query管理Server State
 * - Query Key必含access_mode和prediction_run_id(predicted)
 * - 不在hook内做Mode推断/预测批次选择
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { dataProductAPI } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-client';
import { useAccessState } from '@/stores/access-state';
import type { 
  SharedDimensions, 
  DataProductResponse,
  RegionScope 
} from '@/types';

/**
 * Data Product Hook选项
 */
interface DataProductOptions {
  regionScope: RegionScope;
  regionCode: string;
  regionTimezone?: string;
  enabled?: boolean;
}

/**
 * 构建SharedDimensions
 */
function buildSharedDimensions(
  options: DataProductOptions,
  accessState: {
    accessMode: string;
    dataType: string;
    timeRange: { start: string; end: string };
    weatherType: string;
    productId: string | null;
    predictionRunId: string | null;
  }
): SharedDimensions {
  return {
    region_scope: options.regionScope,
    region_code: options.regionCode,
    time_range: accessState.timeRange,
    data_type: accessState.dataType as any,
    weather_type: accessState.weatherType as any,
    access_mode: accessState.accessMode as any,
    product_id: accessState.productId || undefined,
    prediction_run_id: accessState.predictionRunId || undefined,
    region_timezone: options.regionTimezone,
  };
}

/**
 * 使用L0 Dashboard数据
 */
export function useL0Dashboard(
  options: DataProductOptions
): UseQueryResult<DataProductResponse, Error> {
  const accessState = useAccessState();
  
  const dimensions = buildSharedDimensions(options, accessState);
  
  return useQuery({
    queryKey: queryKeys.dataProducts.l0Dashboard(dimensions),
    queryFn: () => dataProductAPI.getL0Dashboard(dimensions),
    enabled: options.enabled !== false,
  });
}

/**
 * 使用Map Overlays数据
 */
export function useMapOverlays(
  options: DataProductOptions
): UseQueryResult<DataProductResponse, Error> {
  const accessState = useAccessState();
  
  const dimensions = buildSharedDimensions(options, accessState);
  
  return useQuery({
    queryKey: queryKeys.dataProducts.mapOverlays(dimensions),
    queryFn: () => dataProductAPI.getMapOverlays(dimensions),
    enabled: options.enabled !== false,
  });
}

/**
 * 使用L1 Intelligence数据
 */
export function useL1Intelligence(
  options: DataProductOptions
): UseQueryResult<DataProductResponse, Error> {
  const accessState = useAccessState();
  
  const dimensions = buildSharedDimensions(options, accessState);
  
  return useQuery({
    queryKey: queryKeys.dataProducts.l1Intelligence(dimensions),
    queryFn: () => dataProductAPI.getL1Intelligence(dimensions),
    enabled: options.enabled !== false,
  });
}

/**
 * 使用Products列表
 */
export function useProducts(params?: { weather_type?: string }) {
  return useQuery({
    queryKey: queryKeys.products.list(params),
    queryFn: () => productAPI.getProducts(params),
  });
}

/**
 * 使用Product详情
 */
export function useProduct(productId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.products.detail(productId),
    queryFn: () => productAPI.getProduct(productId),
    enabled: enabled && !!productId,
  });
}
