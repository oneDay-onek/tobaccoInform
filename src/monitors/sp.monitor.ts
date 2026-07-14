/**
 * SP站适配器 (smokingpipes.com)
 * 该站使用 Captcha/Cloudflare 质询保护,普通 HTTP 请求会被拦截(403)
 * 改用 Playwright 无头浏览器执行 JS,自动通过质询后解析页面
 *
 * 缺货标志:页面含 "temporarily out of stock" / "sold out" 等文本
 * 有货标志:无缺货文本 + Add to Cart 按钮可点击
 */

import { chromium, Browser } from 'playwright';
import { SiteMonitor, StockResult } from './base';

export class SpMonitor implements SiteMonitor {
  readonly site = 'sp';
  private browserPromise: Promise<Browser> | null = null;

  async checkStock(url: string): Promise<StockResult> {
    const browser = await this.getBrowser();
    const context = await browser.newContext({
      // 模拟真实浏览器
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      locale: 'en-US',
      viewport: { width: 1280, height: 720 },
    });
    const page = await context.newPage();

    try {
      // 导航到商品页,等待网络空闲(确保JS盾通过 + 内容加载)
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

      // 额外等待,确保页面渲染完成
      await page.waitForTimeout(2000);

      // 获取页面文本和按钮状态
      const pageText = await page.evaluate(() => document.body.innerText || '');

      // 用 Playwright 的 locator API 查找 Add to Cart 按钮(支持 :has-text)
      const buttonInfo = await page
        .evaluate(() => {
          // 标准 CSS 选择器查 input 按钮
          const inputBtn = document.querySelector(
            'input[type="submit"][value*="dd to cart" i], input[type="submit"][value*="dd to Cart" i], input.add-to-cart'
          ) as HTMLInputElement | null;
          if (inputBtn) {
            return {
              exists: true,
              disabled: inputBtn.disabled || inputBtn.hasAttribute('disabled'),
            };
          }
          // 标准 CSS 选择器查 button(用 textContent 模糊匹配,因为 :has-text 是 Playwright 专属)
          const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"]'));
          for (const btn of buttons) {
            const text = (btn.textContent || (btn as HTMLInputElement).value || '').trim();
            if (/add to cart/i.test(text)) {
              return {
                exists: true,
                disabled: (btn as HTMLButtonElement).disabled || btn.hasAttribute('disabled'),
              };
            }
          }
          // 兜底:找 .add-to-cart 类
          const fallback = document.querySelector('.add-to-cart') as HTMLElement | null;
          if (fallback) {
            return { exists: true, disabled: fallback.hasAttribute('disabled') };
          }
          return { exists: false, disabled: true };
        })
        .catch(() => ({ exists: false, disabled: true }));

      // 尝试提取价格
      const priceText = await page
        .evaluate(() => {
          const el = document.querySelector('.price, .our-price, [itemprop="price"], .product-price');
          return el ? (el.textContent || '').trim() : '';
        })
        .catch(() => '');

      // 判断缺货
      const outOfStockTexts = [
        'temporarily out of stock',
        'out of stock',
        'sold out',
        'currently unavailable',
        'no longer available',
      ];
      const isOutOfStockText = outOfStockTexts.some((t) =>
        pageText.toLowerCase().includes(t.toLowerCase())
      );
      const isButtonDisabled = !buttonInfo.exists || buttonInfo.disabled;

      // 综合判断:无缺货文本 + 按钮可点击 = 有货
      const inStock = !isOutOfStockText && !isButtonDisabled;

      return {
        inStock,
        detail: inStock
          ? `有货${priceText ? ` / 价格: ${priceText}` : ''}`
          : isOutOfStockText
          ? '缺货'
          : '按钮不可用',
      };
    } finally {
      await context.close();
    }
  }

  /** 复用浏览器实例(避免每次启动开销) */
  private async getBrowser(): Promise<Browser> {
    if (!this.browserPromise) {
      this.browserPromise = chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    }
    return this.browserPromise;
  }

  /** 关闭浏览器(进程退出时调用) */
  async close() {
    if (this.browserPromise) {
      const browser = await this.browserPromise;
      await browser.close();
      this.browserPromise = null;
    }
  }
}
