/**
 * 生活站适配器 (tobaccolifestyle.com)
 * Shopify 站点,通过在商品 URL 后加 .json 获取产品数据
 * 库存判断:匹配 URL 中的 variant ID,检查 available 字段和库存数量
 */

import axios from 'axios';
import { SiteMonitor, StockResult } from './base';

/** Shopify 产品 JSON 返回结构(仅关注需要的字段) */
interface ShopifyVariant {
  id: number;
  available: boolean;
  inventory_quantity?: number;
  inventory_management: string | null;
  price: string;
}

interface ShopifyProduct {
  id: number;
  title: string;
  variants: ShopifyVariant[];
}

interface ShopifyResponse {
  product: ShopifyProduct;
}

export class LifeMonitor implements SiteMonitor {
  readonly site = 'life';

  async checkStock(url: string, extra?: Record<string, unknown>): Promise<StockResult> {
    // 从 extra 取 variantId,或从 URL 解析 ?variant=xxx
    const variantId = (extra?.variantId as number) ?? this.extractVariantId(url);

    // 构造 Shopify JSON API URL(支持 /products/ 和 /collections/x/products/ 两种路径)
    const jsonUrl = this.buildJsonUrl(url);

    // 带重试的请求(429 限流时指数退避)
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const resp = await axios.get<ShopifyResponse>(jsonUrl, {
          timeout: 15000,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            'Accept': 'application/json',
          },
        });

        const product = resp.data?.product;
        if (!product) {
          return { inStock: false, detail: '未获取到产品数据' };
        }

        // 匹配 variant:有指定 ID 就找,没有就用第一个
        const variant = variantId
          ? product.variants.find((v) => v.id === variantId)
          : product.variants[0];
        if (!variant) {
          return { inStock: false, detail: `未找到 variant ${variantId}` };
        }

        // 库存判断(宽松策略):
        // 1. available=true 即认为有货(Shopify 已综合判断)
        // 2. 即使 inventory_quantity=0,只要 available=true 也认为有货
        //    (部分店铺关闭了库存追踪,inventory_quantity 始终为0但实际可售)
        // 3. 仅当 available=false 时才认定缺货
        const inStock = variant.available;
        const qty = variant.inventory_quantity ?? 0;
        return {
          inStock,
          detail: `库存: ${qty} / 价格: HK$${variant.price}` + (inStock && qty === 0 ? ' (可售)' : ''),
        };
      } catch (err) {
        lastError = err as Error;
        const status = (err as { response?: { status?: number } }).response?.status;
        if (status === 429 && attempt < 2) {
          // 限流:指数退避(5s, 10s)
          const wait = 5000 * Math.pow(2, attempt);
          console.log(`[life] 429 限流,${wait / 1000}s 后重试(${attempt + 1}/3)`);
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
      }
    }
    return { inStock: false, detail: `查询失败: ${lastError?.message || '未知错误'}` };
  }

  /** 从 URL 的 query 中提取 variant 参数 */
  private extractVariantId(url: string): number | undefined {
    const match = url.match(/[?&]variant=(\d+)/);
    return match ? Number(match[1]) : undefined;
  }

  /**
   * 把商品页面 URL 转换为 Shopify JSON API URL
   * 支持两种路径:
   *   /products/{handle}                  → /products/{handle}.json
   *   /collections/{c}/products/{handle}  → /products/{handle}.json
   */
  private buildJsonUrl(url: string): string {
    // 去掉 query 部分
    const baseUrl = url.split('?')[0].replace(/\/$/, '');
    // 如果包含 /collections/xxx/products/,替换为 /products/
    const normalizedUrl = baseUrl.replace(/\/collections\/[^/]+\/products\//, '/products/');
    return `${normalizedUrl}.json`;
  }
}
