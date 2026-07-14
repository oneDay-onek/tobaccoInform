/**
 * 主入口
 * 1. 加载商品配置
 * 2. 为每个商品选择对应站点适配器
 * 3. 并发查询库存
 * 4. 收集有货商品,状态去重后聚合推送
 * 5. 支持命令行参数:--test-notify 测试推送、--site=life 只跑某站点
 */

import { PRODUCTS, ProductConfig } from './config/products';
import { LifeMonitor } from './monitors/life.monitor';
import { SpMonitor } from './monitors/sp.monitor';
import { UncleMonitor } from './monitors/uncle.monitor';
import { SiteMonitor, StockResult } from './monitors/base';
import { QyWechatNotifier } from './notifier/qywechat';
import { StateStorage } from './storage/state';

/** 检查结果 */
interface CheckResult {
  product: ProductConfig;
  result: StockResult;
  error?: string;
}

/** 生成商品的唯一 key(用于状态存储) */
function productKey(p: ProductConfig): string {
  return `${p.site}::${p.name}`;
}

/** 站点适配器实例缓存(Playwright浏览器需复用) */
const monitorCache: Record<string, SiteMonitor> = {};

/** 根据站点选择适配器 */
function getMonitor(site: string): SiteMonitor {
  if (!monitorCache[site]) {
    switch (site) {
      case 'life':
        monitorCache[site] = new LifeMonitor();
        break;
      case 'sp':
        monitorCache[site] = new SpMonitor();
        break;
      case 'uncle':
        monitorCache[site] = new UncleMonitor();
        break;
      default:
        throw new Error(`未知站点: ${site}`);
    }
  }
  return monitorCache[site];
}

/** 延迟函数(ms) */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 解析命令行参数 */
function parseArgs(): { testNotify: boolean; site?: string } {
  const args = process.argv.slice(2);
  return {
    testNotify: args.includes('--test-notify'),
    site: args.find((a) => a.startsWith('--site='))?.split('=')[1],
  };
}

async function main() {
  const { testNotify, site: filterSite } = parseArgs();
  console.log(`\n========== 烟草库存监控 ${new Date().toLocaleString('zh-CN')} ==========\n`);

  // 测试推送模式
  if (testNotify) {
    console.log('[main] 测试推送模式');
    const notifier = new QyWechatNotifier();
    if (!notifier.isConfigured()) {
      console.error('[main] 请先配置 QY_WECHAT_WEBHOOK 环境变量');
      process.exit(1);
    }
    await notifier.sendMarkdown(
      `**烟草库存监控测试**\n>这是一条测试通知,收到说明配置成功 ✅\n>时间: ${new Date().toLocaleString('zh-CN')}`
    );
    return;
  }

  // 筛选商品
  const products = filterSite ? PRODUCTS.filter((p) => p.site === filterSite) : PRODUCTS;
  console.log(`[main] 本次监控 ${products.length} 个商品\n`);

  // 串行查询(SP站用Playwright需串行,生活站加延迟避免限流)
  const state = new StateStorage();
  const notifier = new QyWechatNotifier();

  const results: CheckResult[] = [];
  for (const product of products) {
    try {
      const monitor = getMonitor(product.site);
      const extra = product.variantId ? { variantId: product.variantId } : undefined;
      const result = await monitor.checkStock(product.url, extra);
      console.log(`[${product.site}] ${product.name}: ${result.inStock ? '✅有货' : '❌缺货'} ${result.detail || ''}`);
      results.push({ product, result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[${product.site}] ${product.name}: 查询失败 - ${msg}`);
      results.push({ product, result: { inStock: false }, error: msg });
    }
    // 请求间隔,避免触发限流(生活站2秒,SP站1秒,Uncle站1秒)
    await sleep(product.site === 'life' ? 2000 : 1000);
  }

  // 收集需要通知的商品(有货 + 状态去重)
  const toNotify: CheckResult[] = [];
  for (const r of results) {
    if (r.result.inStock) {
      const key = productKey(r.product);
      if (state.shouldNotify(key, true)) {
        toNotify.push(r);
      }
    }
    // 无论是否通知,都更新状态
    state.update(productKey(r.product), r.result.inStock, false);
  }

  // 聚合推送
  if (toNotify.length === 0) {
    console.log('\n[main] 无新增有货商品,不推送');
  } else {
    console.log(`\n[main] 发现 ${toNotify.length} 个新有货商品,准备推送`);

    // 构造 markdown 消息(企微 markdown 语法)
    const lines: string[] = [];
    lines.push(`**🎉 烟草库存监控 - 有货提醒**`);
    lines.push(`>时间: ${new Date().toLocaleString('zh-CN')}`);
    lines.push(`>发现 ${toNotify.length} 个商品有货:`);
    lines.push('');

    for (const r of toNotify) {
      const { product, result } = r;
      const siteName = { life: '生活站', sp: 'SP站', uncle: '茄营站' }[product.site] || product.site;
      lines.push(`**${product.name}** (${siteName})`);
      if (result.detail) {
        lines.push(`> ${result.detail}`);
      }
      lines.push(`> [点击购买](${product.url})`);
      lines.push('');

      // 标记已通知
      state.update(productKey(product), true, true);
    }

    const content = lines.join('\n');
    const ok = await notifier.sendMarkdown(content);
    if (ok) {
      console.log('[main] 推送成功');
    } else {
      console.error('[main] 推送失败,请检查 webhook 配置');
    }
  }

  // 汇总
  const inStockCount = results.filter((r) => r.result.inStock).length;
  const errorCount = results.filter((r) => r.error).length;
  console.log(`\n[main] 完成: 有货 ${inStockCount} / 缺货 ${results.length - inStockCount - errorCount} / 失败 ${errorCount}`);

  // 关闭 Playwright 浏览器(如有)
  const spMonitor = monitorCache['sp'] as SpMonitor | undefined;
  if (spMonitor && typeof (spMonitor as { close?: () => Promise<void> }).close === 'function') {
    await (spMonitor as { close: () => Promise<void> }).close();
  }
}

main().catch((err) => {
  console.error('[main] 程序异常退出:', err);
  process.exit(1);
});
