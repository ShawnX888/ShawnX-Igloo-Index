/**
 * TanStack Query Client配置
 * 
 * 职责: 管理Server State,缓存策略,重试逻辑
 * 
 * Reference:
 * - docs/v2/v2实施细则/16-前端项目结构与类型定义-细则.md
 * - RD-性能优化.md
 * 
 * 硬规则:
 * - 禁止useEffect拉数据
 * - hover不触发重请求
 * - query key必含access_mode, predicted必含prediction_run_id
 */

import { QueryClient } from '@tanstack/react-query';

/**
 * Query Client配置
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stale Time: 数据多久后过期
      staleTime: 5 * 60 * 1000, // 5分钟
      
      // Cache Time: 缓存保留多久
      gcTime: 30 * 60 * 1000, // 30分钟
      
      // 重试策略
      retry: (failureCount, error: any) => {
        // 4xx错误不重试
        if (error?.status >= 400 && error?.status < 500) {
          return false;
        }
        // 最多重试3次
        return failureCount < 3;
      },
      
      // 重试延迟 (指数退避)
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      
      // 窗口焦点时不自动重新获取
      refetchOnWindowFocus: false,
      
      // 网络重连时重新获取
      refetchOnReconnect: true,
      
      // Mount时不自动重新获取
      refetchOnMount: false,
    },
    mutations: {
      // Mutation重试策略
      retry: 1,
    },
  },
});

/**
 * 生成Query Key
 * 
 * Query Key格式:
 * [dataProduct, dimensions]
 * 
 * 硬规则:
 * - 必含access_mode
 * - predicted必含prediction_run_id
 */
export function createQueryKey(
  dataProduct: string,
  dimensions: {
    region_scope?: string;
    region_code?: string;
    time_range?: { start: string; end: string };
    data_type?: string;
    weather_type?: string;
    access_mode: string; // 必须
    product_id?: string | null;
    prediction_run_id?: string | null; // predicted必须
  }
): [string, typeof dimensions] {
  // 验证: predicted必须包含prediction_run_id
  if (dimensions.data_type === 'predicted' && !dimensions.prediction_run_id) {
    console.warn('[QueryKey] predicted data_type requires prediction_run_id');
  }
  
  return [dataProduct, dimensions];
}

/**
 * 预定义Query Keys
 */
export const queryKeys = {
  dataProducts: {
    l0Dashboard: (dimensions: any) => createQueryKey('l0-dashboard', dimensions),
    mapOverlays: (dimensions: any) => createQueryKey('map-overlays', dimensions),
    l1Intelligence: (dimensions: any) => createQueryKey('l1-intelligence', dimensions),
  },
  products: {
    list: (params?: any) => ['products', 'list', params],
    detail: (id: string) => ['products', 'detail', id],
  },
  predictionRuns: {
    active: () => ['prediction-runs', 'active'],
    list: (filter?: any) => ['prediction-runs', 'list', filter],
  },
};
