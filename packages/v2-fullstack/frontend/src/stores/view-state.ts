/**
 * View State Store (Zustand)
 * 
 * 职责: 管理UI状态、交互状态
 * 
 * Reference:
 * - docs/v2/v2实施细则/16-前端项目结构与类型定义-细则.md
 * - RD-分层职责与协作边界.md
 * 
 * 状态分类:
 * - View State (此文件): 侧边栏、面板、地图viewport等
 * - Access State (access-state.ts): access_mode、用户会话
 * - Server State (TanStack Query): 数据产品响应
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { RegionScope } from '@/types';

/**
 * 地图Viewport状态
 */
export interface MapViewport {
  center: { lat: number; lng: number };
  zoom: number;
  bearing?: number;
  pitch?: number;
}

/**
 * 锁定区域状态
 */
export interface LockedRegion {
  scope: RegionScope;
  code: string;
  name?: string;
}

/**
 * 面板状态
 */
export interface PanelState {
  l0Sidebar: {
    open: boolean;
    activeTab?: string;
  };
  l1Intelligence: {
    open: boolean;
    region?: LockedRegion;
  };
  l2Details: {
    open: boolean;
    eventId?: string;
  };
}

/**
 * 图层可见性
 */
export interface LayerVisibility {
  weatherHeatmap: boolean;
  riskMarkers: boolean;
  claimsOverlay: boolean;
  adminBoundaries: boolean;
}

/**
 * View State类型
 */
interface ViewState {
  // 地图状态
  mapViewport: MapViewport;
  lockedRegion: LockedRegion | null;
  
  // 面板状态
  panels: PanelState;
  
  // 图层可见性
  layers: LayerVisibility;
  
  // Actions
  setMapViewport: (viewport: MapViewport) => void;
  setLockedRegion: (region: LockedRegion | null) => void;
  togglePanel: (panel: keyof PanelState) => void;
  openL1Intelligence: (region: LockedRegion) => void;
  closeL1Intelligence: () => void;
  toggleLayer: (layer: keyof LayerVisibility) => void;
  reset: () => void;
}

/**
 * 初始状态
 */
const initialState = {
  mapViewport: {
    center: { lat: 34.5, lng: 110.0 }, // 中国中心
    zoom: 5,
  },
  lockedRegion: null,
  panels: {
    l0Sidebar: { open: false },
    l1Intelligence: { open: false },
    l2Details: { open: false },
  },
  layers: {
    weatherHeatmap: true,
    riskMarkers: true,
    claimsOverlay: false,
    adminBoundaries: true,
  },
};

/**
 * View State Store
 */
export const useViewState = create<ViewState>()(
  devtools(
    persist(
      (set) => ({
        ...initialState,
        
        setMapViewport: (viewport) =>
          set({ mapViewport: viewport }, false, 'setMapViewport'),
        
        setLockedRegion: (region) =>
          set({ lockedRegion: region }, false, 'setLockedRegion'),
        
        togglePanel: (panel) =>
          set(
            (state) => ({
              panels: {
                ...state.panels,
                [panel]: {
                  ...state.panels[panel],
                  open: !state.panels[panel].open,
                },
              },
            }),
            false,
            'togglePanel'
          ),
        
        openL1Intelligence: (region) =>
          set(
            (state) => ({
              lockedRegion: region,
              panels: {
                ...state.panels,
                l1Intelligence: { open: true, region },
              },
            }),
            false,
            'openL1Intelligence'
          ),
        
        closeL1Intelligence: () =>
          set(
            (state) => ({
              lockedRegion: null,
              panels: {
                ...state.panels,
                l1Intelligence: { open: false },
              },
            }),
            false,
            'closeL1Intelligence'
          ),
        
        toggleLayer: (layer) =>
          set(
            (state) => ({
              layers: {
                ...state.layers,
                [layer]: !state.layers[layer],
              },
            }),
            false,
            'toggleLayer'
          ),
        
        reset: () => set(initialState, false, 'reset'),
      }),
      {
        name: 'view-state',
        partialize: (state) => ({
          // 只持久化部分状态
          mapViewport: state.mapViewport,
          layers: state.layers,
        }),
      }
    ),
    { name: 'ViewState' }
  )
);
