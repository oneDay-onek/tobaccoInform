/**
 * 站点适配器基类
 * 每个站点(生活站、SP站)实现该接口,提供统一的库存查询能力
 */

/** 库存查询结果 */
export interface StockResult {
  /** 是否有货 */
  inStock: boolean;
  /** 额外信息(如库存数量、价格等),用于通知展示 */
  detail?: string;
}

/** 站点适配器接口 */
export interface SiteMonitor {
  /** 站点标识 */
  readonly site: string;

  /**
   * 查询指定商品的库存状态
   * @param url 商品页面 URL
   * @param extra 站点特定参数(如生活站的 variantId)
   */
  checkStock(url: string, extra?: Record<string, unknown>): Promise<StockResult>;
}
