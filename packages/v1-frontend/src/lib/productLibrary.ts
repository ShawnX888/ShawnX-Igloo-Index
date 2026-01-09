/**
 * 产品库实现
 * 提供产品查询、验证和管理功能
 */

import { Product, ProductType, ProductLibraryConfig } from '../types/product';
import { ProductLibrary as IProductLibrary } from '../interfaces/productLibrary';
import { PRODUCT_LIBRARY_CONFIG } from '../data/products';

/**
 * 产品库实现类
 */
export class ProductLibraryImpl implements IProductLibrary {
  private products: Map<string, Product>;
  private productsByType: Map<ProductType, Product[]>;

  constructor(config?: ProductLibraryConfig) {
    const productConfig = config || PRODUCT_LIBRARY_CONFIG;
    
    // 初始化产品映射
    this.products = new Map();
    this.productsByType = new Map();

    // 加载产品配置
    this.loadProducts(productConfig.products);
  }

  /**
   * 加载产品配置
   */
  private loadProducts(products: Product[]): void {
    // 验证并加载产品
    for (const product of products) {
      // 验证产品定义
      if (this.validateProduct(product)) {
        // 添加到产品映射
        this.products.set(product.id, product);

        // 添加到类型索引
        const typeProducts = this.productsByType.get(product.type) || [];
        typeProducts.push(product);
        this.productsByType.set(product.type, typeProducts);
      } else {
        console.warn(`Invalid product definition: ${product.id}`, product);
      }
    }
  }

  /**
   * 验证产品定义
   */
  private validateProduct(product: Product): boolean {
    // 检查必需字段
    if (!product.id || !product.name || !product.type || !product.riskRules) {
      return false;
    }

    // 检查产品类型
    if (!['daily', 'weekly', 'monthly'].includes(product.type)) {
      return false;
    }

    // 检查天气类型
    if (!product.weatherType) {
      return false;
    }

    // 检查风险规则
    const { riskRules } = product;
    if (!riskRules.triggerType || !riskRules.timeWindow || !riskRules.thresholds || !riskRules.calculation) {
      return false;
    }

    // 检查风险规则的天气类型必须与产品天气类型一致
    if (riskRules.weatherType !== product.weatherType) {
      console.warn(`Product ${product.id}: riskRules.weatherType (${riskRules.weatherType}) does not match product.weatherType (${product.weatherType})`);
      return false;
    }

    // 检查触发类型必须与产品类型一致
    if (riskRules.triggerType !== product.type) {
      console.warn(`Product ${product.id}: riskRules.triggerType (${riskRules.triggerType}) does not match product.type (${product.type})`);
      return false;
    }

    // 检查阈值配置
    if (!Array.isArray(riskRules.thresholds) || riskRules.thresholds.length === 0) {
      return false;
    }

    // 检查阈值级别是否为 tier1/tier2/tier3
    const validLevels = ['tier1', 'tier2', 'tier3'];
    for (const threshold of riskRules.thresholds) {
      if (!validLevels.includes(threshold.level)) {
        console.warn(`Invalid threshold level for product ${product.id}: ${threshold.level}. Expected tier1, tier2, or tier3`);
        return false;
      }
    }

    // 检查阈值是否按值排序（用于风险级别判断）
    const thresholdValues = riskRules.thresholds.map(t => t.value);
    const isAscending = thresholdValues.every((val, idx) => idx === 0 || val >= thresholdValues[idx - 1]);
    const isDescending = thresholdValues.every((val, idx) => idx === 0 || val <= thresholdValues[idx - 1]);
    
    if (!isAscending && !isDescending) {
      console.warn(`Thresholds for product ${product.id} are not sorted`);
    }

    // 检查时间窗口配置
    if (!riskRules.timeWindow.type || !riskRules.timeWindow.size) {
      return false;
    }

    // 检查计算配置
    if (!riskRules.calculation.aggregation || !riskRules.calculation.operator) {
      return false;
    }

    // 验证 payoutRules（如果存在）
    if (product.payoutRules) {
      const { payoutRules } = product;
      
      // 检查理赔额度百分比配置
      if (!payoutRules.payoutPercentages) {
        console.warn(`Product ${product.id}: payoutRules.payoutPercentages is missing`);
        return false;
      }

      const { payoutPercentages } = payoutRules;
      if (typeof payoutPercentages.tier1 !== 'number' || 
          typeof payoutPercentages.tier2 !== 'number' || 
          typeof payoutPercentages.tier3 !== 'number') {
        console.warn(`Product ${product.id}: payoutPercentages must have tier1, tier2, and tier3 as numbers`);
        return false;
      }

      // 验证理赔额度百分比是否符合标准（tier1: 20%, tier2: 50%, tier3: 100%）
      // 注意：这里只做警告，不强制要求，因为未来可能有不同的配置
      if (payoutPercentages.tier1 !== 20 || payoutPercentages.tier2 !== 50 || payoutPercentages.tier3 !== 100) {
        console.warn(`Product ${product.id}: payoutPercentages may not match standard values (tier1: 20%, tier2: 50%, tier3: 100%)`);
      }
    }

    return true;
  }

  /**
   * 根据ID获取产品
   */
  getProduct(id: string): Product | null {
    return this.products.get(id) || null;
  }

  /**
   * 根据类型获取产品列表
   */
  getProductsByType(type: ProductType): Product[] {
    return this.productsByType.get(type) || [];
  }

  /**
   * 获取所有产品
   */
  getAllProducts(): Product[] {
    return Array.from(this.products.values());
  }

  /**
   * 检查产品是否存在
   */
  hasProduct(id: string): boolean {
    return this.products.has(id);
  }

  /**
   * 注册新产品（用于未来扩展）
   */
  registerProduct(product: Product): boolean {
    if (!this.validateProduct(product)) {
      console.error(`Failed to register product: ${product.id} - validation failed`);
      return false;
    }

    // 检查产品ID是否已存在
    if (this.products.has(product.id)) {
      console.warn(`Product ${product.id} already exists, updating...`);
    }

    // 添加到产品映射
    this.products.set(product.id, product);

    // 添加到类型索引
    const typeProducts = this.productsByType.get(product.type) || [];
    if (!typeProducts.find(p => p.id === product.id)) {
      typeProducts.push(product);
      this.productsByType.set(product.type, typeProducts);
    }

    return true;
  }

  /**
   * 获取产品数量
   */
  getProductCount(): number {
    return this.products.size;
  }

  /**
   * 获取产品数量（按类型）
   */
  getProductCountByType(type: ProductType): number {
    return this.productsByType.get(type)?.length || 0;
  }
}

// 导出单例实例
export const productLibrary = new ProductLibraryImpl();

// 导出类型和接口
export type { Product, ProductType, RiskLevel, Threshold, RiskRule, CalculationConfig, PayoutRule } from '../types/product';
export type { ProductLibrary } from '../interfaces/productLibrary';

