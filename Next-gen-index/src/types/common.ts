/**
 * 通用类型定义
 */

/**
 * 可空类型
 */
export type Nullable<T> = T | null;

/**
 * 可选类型
 */
export type Optional<T> = T | undefined;

/**
 * 结果类型（用于函数返回值）
 */
export interface Result<T, E = Error> {
  /** 是否成功 */
  success: boolean;
  /** 数据（成功时） */
  data?: T;
  /** 错误（失败时） */
  error?: E;
}

/**
 * 异步结果类型
 */
export type AsyncResult<T, E = Error> = Promise<Result<T, E>>;

/**
 * 键值对类型
 */
export type KeyValuePair<K = string, V = unknown> = {
  key: K;
  value: V;
};

/**
 * 时间戳类型
 */
export type Timestamp = number | Date | string;

