/**
 * Uncle站适配器 (pipeuncle.com)
 * SPA单页应用,但页面加载时会调用后端API获取商品详情
 * 直接请求API更稳定、更快,无需Playwright
 *
 * API: https://pipeuncle-prod-afd-end-point-a2gfecefc8drfsgq.a03.azurefd.net/app-api/product/spu/get-detail?id={商品ID}
 * 必需请求头: tenant-id: 1, terminal: 40
 *
 * 库存判断: data.stock > 0 且 skus[0].forceSoldOut == false
 */

import axios from 'axios';
import { SiteMonitor, StockResult } from './base';

/** API 返回结构(仅关注需要的字段) */
interface UncleSku {
  stock: number;
  forceSoldOut: boolean;
  price: number;
}

interface UncleProduct {
  id: number;
  name: string;
  stock: number;
  price: number;
  skus: UncleSku[];
}

interface UncleResponse {
  code: number;
  msg: string;
  data: UncleProduct;
}

const API_BASE = 'https://pipeuncle-prod-afd-end-point-a2gfecefc8drfsgq.a03.azurefd.net/app-api/product/spu/get-detail';

export class UncleMonitor implements SiteMonitor {
  readonly site = 'uncle';

  async checkStock(url: string): Promise<StockResult> {
    // 从 URL 提取商品 ID:https://www.pipeuncle.com/products/300 → 300
    const productId = this.extractProductId(url);
    if (!productId) {
      return { inStock: false, detail: '未找到商品 ID' };
    }

    try {
      const resp = await axios.get<UncleResponse>(`${API_BASE}?id=${productId}`, {
        timeout: 15000,
        headers: {
          'tenant-id': '1',
          'terminal': '40',
          'Accept': 'application/json',
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          'Referer': 'https://www.pipeuncle.com/',
        },
      });

      const data = resp.data?.data;
      if (!data) {
        return { inStock: false, detail: '未获取到产品数据' };
      }

      // 综合判断:总库存 > 0 且第一个SKU未被强制售罄
      const sku = data.skus?.[0];
      const stock = data.stock ?? sku?.stock ?? 0;
      const forceSoldOut = sku?.forceSoldOut ?? false;
      const inStock = stock > 0 && !forceSoldOut;

      // 价格转换(分 → 元)
      const priceCents = sku?.price ?? data.price ?? 0;
      const priceStr = priceCents > 0 ? `$${(priceCents / 100).toFixed(2)}` : '';

      return {
        inStock,
        detail: inStock
          ? `有货 / 库存: ${stock}${priceStr ? ` / 价格: ${priceStr}` : ''}`
          : `缺货${stock === 0 ? ' / 库存为0' : ''}${forceSoldOut ? ' / 强制售罄' : ''}`,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { inStock: false, detail: `查询失败: ${msg}` };
    }
  }

  /** 从 URL 提取商品 ID */
  private extractProductId(url: string): number | undefined {
    const match = url.match(/\/products\/(\d+)/);
    return match ? Number(match[1]) : undefined;
  }
}
