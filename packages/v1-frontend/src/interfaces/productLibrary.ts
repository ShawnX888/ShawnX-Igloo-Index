/**
 * 产品库接口定义
 */

import { Product, ProductType } from '../types';

/**
 * 产品库接口
 */
export interface ProductLibrary {
  /**
   * 根据ID获取产品
   * @param id 产品ID
   * @returns 产品对象，如果不存在则返回null
   */
  getProduct(id: string): Product | null;

  /**
   * 根据类型获取产品列表
   * @param type 产品类型
   * @returns 产品列表
   */
  getProductsByType(type: ProductType): Product[];

  /**
   * 获取所有产品
   * @returns 所有产品列表
   */
  getAllProducts(): Product[];

  /**
   * 检查产品是否存在
   * @param id 产品ID
   * @returns 是否存在
   */
  hasProduct(id: string): boolean;
}

