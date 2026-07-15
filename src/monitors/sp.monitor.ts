/**
 * SP站适配器 (smokingpipes.com)
 * 该站使用 Captcha/Cloudflare 质询保护,普通 HTTP 请求会被拦截(403)
 * 改用 Playwright 无头浏览器执行 JS,自动通过质询后解析页面
 *
 * 缺货标志:页面含 "temporarily out of stock" / "sold out" 等文本
 * 有货标志:无缺货文本(宽松策略,不依赖按钮状态)
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
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    // 注入反检测脚本,隐藏 Playwright/webdriver 标志,避免触发 Captcha 盾
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      (window as any).chrome = { runtime: {} };
    });

    const page = await context.newPage();

    try {
      // 导航到商品页,用 domcontentloaded 比 networkidle 更快更稳
      // SP站有持续请求,networkidle 会一直等不到
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });

      // 等待页面主要内容加载(最多10秒,超时也继续)
      await page
        .waitForSelector('body', { timeout: 10000 })
        .catch(() => {});

      // 额外等待,确保JS盾通过 + 内容渲染
      await page.waitForTimeout(3000);

      // 获取页面文本
      const pageText = await page.evaluate(() => document.body.innerText || '');

      // 尝试提取价格
      const priceText = await page
        .evaluate(() => {
          const el = document.querySelector('.price, .our-price, [itemprop="price"], .product-price');
          return el ? (el.textContent || '').trim() : '';
        })
        .catch(() => '');

      // 判断缺货(宽松策略,但需要验证页面已正常加载):
      // 1. 先验证页面内容不为空(Captcha盾拦截时页面为空,不能误判为有货)
      // 2. 页面明确包含缺货文本 → 缺货
      // 3. 无缺货文本且页面有内容 → 有货
      // 4. 不依赖按钮状态(部分商品按钮置灰但实际可加购)

      // Captcha盾检测:页面标题含 "Just a moment" 或正文过短
      const pageTitle = await page.title().catch(() => '');
      const isCaptchaBlocked = pageTitle.includes('Just a moment') || pageText.length < 200;

      if (isCaptchaBlocked) {
        return { inStock: false, detail: '页面未加载完成(Captcha盾),无法判断' };
      }

      const outOfStockTexts = [
        'temporarily out of stock',
        'out of stock',
        'sold out',
        'currently unavailable',
        'no longer available',
        'not available',
        'discontinued',
      ];
      const isOutOfStockText = outOfStockTexts.some((t) =>
        pageText.toLowerCase().includes(t.toLowerCase())
      );

      // 仅当明确出现缺货文本时才判定为缺货
      const inStock = !isOutOfStockText;

      return {
        inStock,
        detail: inStock
          ? `有货${priceText ? ` / 价格: ${priceText}` : ''}`
          : '缺货',
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
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
        ],
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
