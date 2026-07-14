/**
 * 生活站适配器 (tobaccolifestyle.com)
 * Shopify 站点,但 .json API 不返回库存字段
 * 改用 Playwright 渲染页面,检测以下有货标志:
 *   1. 页面含 "有存货" 文本(中文主题的有货标志)
 *   2. "添加到购物车" 按钮存在且未禁用
 * 缺货标志:页面含 "售罄" / "Sold out" / "缺货" 文本(需排除推荐商品区域)
 */

import { chromium, Browser } from 'playwright';
import { SiteMonitor, StockResult } from './base';

export class LifeMonitor implements SiteMonitor {
  readonly site = 'life';
  private browserPromise: Promise<Browser> | null = null;

  async checkStock(url: string): Promise<StockResult> {
    const browser = await this.getBrowser();
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      locale: 'zh-CN',
      viewport: { width: 1280, height: 720 },
    });
    const page = await context.newPage();

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);

      const pageTitle = await page.title().catch(() => '');
      const pageText = await page.evaluate(() => document.body.innerText || '');

      // Captcha 盾检测
      if (pageTitle.includes('Just a moment') || pageText.length < 200) {
        return { inStock: false, detail: '页面未加载完成,无法判断' };
      }

      // 提取主产品区域的文本(排除推荐商品)
      const mainInfo = await page.evaluate(() => {
        // 找主产品区域(Shopify 主题通常在 .product 或 .product__info 里)
        const mainEl =
          document.querySelector('.product__info') ||
          document.querySelector('.product-info') ||
          document.querySelector('.product-form') ||
          document.querySelector('main');

        const mainText = mainEl ? (mainEl as HTMLElement).innerText || '' : '';

        // 找加购按钮
        const addBtn = document.querySelector('.product-form__submit, .add-to-cart, button[type="submit"]');
        const btnText = addBtn ? (addBtn.textContent || '').trim() : '';
        const btnDisabled = addBtn ? (addBtn as HTMLButtonElement).disabled || addBtn.hasAttribute('disabled') : true;

        // 找价格
        const priceEl = document.querySelector('.price, .product-price, [data-price]');
        const price = priceEl ? (priceEl.textContent || '').trim() : '';

        return { mainText, btnText, btnDisabled, price };
      });

      // 有货标志:页面含 "有存货"
      const hasInStockText = mainInfo.mainText.includes('有存货');

      // 缺货标志:主区域含 "售罄" / "Sold out" / "缺货"
      const outOfStockTexts = ['售罄', 'Sold out', '缺货', '缺時缺貨', 'out of stock', 'sold out'];
      const hasOutOfStockText = outOfStockTexts.some((t) => mainInfo.mainText.includes(t));

      // 综合判断:
      // 1. 明确有 "有存货" → 有货
      // 2. 明确有缺货文本 → 缺货
      // 3. 都没有 → 看按钮状态(按钮可点 = 有货)
      let inStock = false;
      let detail = '';

      if (hasInStockText) {
        inStock = true;
        detail = `有货${mainInfo.price ? ` / 价格: ${mainInfo.price}` : ''}`;
      } else if (hasOutOfStockText) {
        inStock = false;
        detail = '缺货';
      } else {
        // 兜底:看加购按钮是否可点
        inStock = !mainInfo.btnDisabled && mainInfo.btnText.length > 0;
        detail = inStock
          ? `有货${mainInfo.price ? ` / 价格: ${mainInfo.price}` : ''}`
          : '缺货(按钮不可用)';
      }

      return { inStock, detail };
    } finally {
      await context.close();
    }
  }

  /** 复用浏览器实例 */
  private async getBrowser(): Promise<Browser> {
    if (!this.browserPromise) {
      this.browserPromise = chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    }
    return this.browserPromise;
  }

  /** 关闭浏览器 */
  async close() {
    if (this.browserPromise) {
      const browser = await this.browserPromise;
      await browser.close();
      this.browserPromise = null;
    }
  }
}
