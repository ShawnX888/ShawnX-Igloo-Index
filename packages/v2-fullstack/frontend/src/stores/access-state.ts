/**
 * Access State Store (Zustand)
 * 
 * 职责: 管理access_mode、预测批次、时间范围等
 * 
 * Reference:
 * - docs/v2/v2实施细则/16-前端项目结构与类型定义-细则.md
 * - Phase 0 Step 02: Access Mode基线
 * - Phase 0 Step 03: Prediction Run基线
 * 
 * 硬规则:
 * - access_mode必须作为query key的一部分
 * - prediction_run_id必须统一(不允许混批次)
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { 
  AccessMode, 
  DataType, 
  WeatherType,
  TimeRangeUTC,
} from '@/types';

/**
 * Access State类型
 */
interface AccessState {
  // Access Mode
  accessMode: AccessMode;
  
  // Data Type & Prediction
  dataType: DataType;
  predictionRunId: string | null;
  
  // Time Range
  timeRange: TimeRangeUTC;
  
  // Weather & Product
  weatherType: WeatherType;
  productId: string | null;
  
  // Actions
  setAccessMode: (mode: AccessMode) => void;
  setDataType: (type: DataType) => void;
  setPredictionRunId: (runId: string | null) => void;
  setTimeRange: (range: TimeRangeUTC) => void;
  setWeatherType: (type: WeatherType) => void;
  setProductId: (id: string | null) => void;
  reset: () => void;
}

/**
 * 默认时间范围: 最近7天
 */
function getDefaultTimeRange(): TimeRangeUTC {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 7);
  
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

/**
 * 初始状态
 */
const initialState = {
  accessMode: 'demo_public' as AccessMode,
  dataType: 'historical' as DataType,
  predictionRunId: null,
  timeRange: getDefaultTimeRange(),
  weatherType: 'rainfall' as WeatherType,
  productId: null,
};

/**
 * Access State Store
 */
export const useAccessState = create<AccessState>()(
  devtools(
    persist(
      (set) => ({
        ...initialState,
        
        setAccessMode: (mode) =>
          set({ accessMode: mode }, false, 'setAccessMode'),
        
        setDataType: (type) =>
          set(
            (state) => ({
              dataType: type,
              // 切换到historical时清除prediction_run_id
              predictionRunId: type === 'historical' ? null : state.predictionRunId,
            }),
            false,
            'setDataType'
          ),
        
        setPredictionRunId: (runId) =>
          set({ predictionRunId: runId }, false, 'setPredictionRunId'),
        
        setTimeRange: (range) =>
          set({ timeRange: range }, false, 'setTimeRange'),
        
        setWeatherType: (type) =>
          set({ weatherType: type }, false, 'setWeatherType'),
        
        setProductId: (id) =>
          set({ productId: id }, false, 'setProductId'),
        
        reset: () => set(initialState, false, 'reset'),
      }),
      {
        name: 'access-state',
        partialize: (state) => ({
          // 持久化所有状态
          accessMode: state.accessMode,
          dataType: state.dataType,
          timeRange: state.timeRange,
          weatherType: state.weatherType,
          productId: state.productId,
          // 不持久化prediction_run_id (每次加载时重新获取active_run)
        }),
      }
    ),
    { name: 'AccessState' }
  )
);
