/**
 * API Client Layer
 * 
 * 职责: 纯transport层,不做业务口径推断
 * 
 * Reference:
 * - docs/v2/v2实施细则/16-前端项目结构与类型定义-细则.md
 * - RD-分层职责与协作边界.md
 * 
 * 硬规则:
 * - 不在此层做Mode推断/预测批次选择
 * - 透传trace_id/correlation_id
 * - 统一错误处理
 */

import type { 
  SharedDimensions, 
  DataProductResponse,
  TraceContext 
} from '@/types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

/**
 * API Client配置
 */
interface ApiClientConfig {
  baseURL?: string;
  timeout?: number;
  headers?: Record<string, string>;
}

/**
 * API请求选项
 */
interface RequestOptions {
  trace_context?: Partial<TraceContext>;
  timeout?: number;
}

/**
 * API错误
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public response?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * 生成trace_id
 */
function generateTraceId(): string {
  return `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * API Client
 */
export class ApiClient {
  private baseURL: string;
  private timeout: number;
  private defaultHeaders: Record<string, string>;
  
  constructor(config: ApiClientConfig = {}) {
    this.baseURL = config.baseURL || API_BASE_URL;
    this.timeout = config.timeout || 30000;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...config.headers,
    };
  }
  
  /**
   * 通用请求方法
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit & RequestOptions = {}
  ): Promise<T> {
    const { trace_context, ...fetchOptions } = options;
    
    // 生成trace_id
    const traceId = trace_context?.trace_id || generateTraceId();
    
    const url = `${this.baseURL}${endpoint}`;
    const headers = {
      ...this.defaultHeaders,
      ...fetchOptions.headers,
      'X-Trace-ID': traceId,
    };
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      
      const response = await fetch(url, {
        ...fetchOptions,
        headers,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          errorData.message || `HTTP ${response.status}`,
          response.status,
          errorData
        );
      }
      
      return await response.json();
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new ApiError('Request timeout', 408);
        }
        throw new ApiError(error.message, 0);
      }
      
      throw new ApiError('Unknown error', 0);
    }
  }
  
  /**
   * GET请求
   */
  async get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }
  
  /**
   * POST请求
   */
  async post<T>(
    endpoint: string,
    data?: any,
    options?: RequestOptions
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
  
  /**
   * PUT请求
   */
  async put<T>(
    endpoint: string,
    data?: any,
    options?: RequestOptions
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }
  
  /**
   * DELETE请求
   */
  async delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

/**
 * 默认API客户端实例
 */
export const apiClient = new ApiClient();

/**
 * Data Product API
 */
export const dataProductAPI = {
  /**
   * 获取L0 Dashboard数据
   */
  getL0Dashboard: (
    dimensions: SharedDimensions,
    options?: RequestOptions
  ) => {
    return apiClient.post<DataProductResponse>(
      '/data-products/l0-dashboard',
      dimensions,
      options
    );
  },
  
  /**
   * 获取Map Overlays数据
   */
  getMapOverlays: (
    dimensions: SharedDimensions,
    options?: RequestOptions
  ) => {
    return apiClient.post<DataProductResponse>(
      '/data-products/map-overlays',
      dimensions,
      options
    );
  },
  
  /**
   * 获取L1 Intelligence数据
   */
  getL1Intelligence: (
    dimensions: SharedDimensions,
    options?: RequestOptions
  ) => {
    return apiClient.post<DataProductResponse>(
      '/data-products/l1-intelligence',
      dimensions,
      options
    );
  },
};

/**
 * Product API
 */
export const productAPI = {
  /**
   * 获取产品列表
   */
  getProducts: (params?: { weather_type?: string }, options?: RequestOptions) => {
    const query = params ? `?${new URLSearchParams(params as any).toString()}` : '';
    return apiClient.get(`/products${query}`, options);
  },
  
  /**
   * 获取产品详情
   */
  getProduct: (productId: string, options?: RequestOptions) => {
    return apiClient.get(`/products/${productId}`, options);
  },
};
