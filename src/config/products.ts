/**
 * 监控商品配置
 *
 * 数据源:cigar.cab 聚合 API
 *   GET https://cigar.cab/api/products/{productId}/channels
 *
 * 每个 productId 对应一个斗草商品,API 会返回该商品在各渠道(4noggins、tobaccolifestyle、smokingpipes 等)
 * 的价格、库存、链接、补货时间等信息。无需逐个站点爬取。
 */

export interface ProductConfig {
  /** cigar.cab 的商品 ID */
  productId: number;
  /** 用户便于识别的中文名(仅用于日志/通知标题,与 API 返回的 productName 不同) */
  name: string;
}

/**
 * 监控商品列表(共 15 个斗草商品)
 * 来源:交接文档第 3 节
 */
export const PRODUCTS: ProductConfig[] = [
  { productId: 7180, name: '黄绞盘' },
  { productId: 8718, name: 'F&T 小白' },
  { productId: 8721, name: 'F&T 特别布朗' },
  { productId: 8717, name: 'F&T 混合切' },
  { productId: 8929, name: 'GH 光明' },
  { productId: 11627, name: 'PH 金切' },
  { productId: 11693, name: 'PH 伪姑' },
  { productId: 12509, name: 'SG FV' },
  { productId: 12513, name: 'SG FVP' },
  { productId: 12550, name: 'SG 山姆' },
  { productId: 12570, name: 'SG 圣詹' },
  { productId: 12567, name: 'SG 圣詹砖' },
  { productId: 12463, name: 'SG 最佳布朗' },
  { productId: 12483, name: 'SG 马车夫' },
  { productId: 14633, name: '威棍子' },
  { productId: 14226, name: '威塞克斯金砖' },
];
