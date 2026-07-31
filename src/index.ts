/**
 * 主入口 - 基于 cigar.cab 聚合 API 的比价监控
 *
 * 流程:
 *   1. 串行拉取每个 productId 的全部渠道 (/api/products/{id}/channels)
 *   2. 对比上次快照,检测每个渠道的 (isInStock, lastNotifiedTime) 变化
 *   3. 按 (商品, 站点, 规格) 分组,每组发 1 条企微消息
 *   4. 提交本次快照到 state.json
 *
 * 通知粒度: 单商品 + 单网站 + 单规格 = 1 条消息
 *
 * 命令行参数:
 *   --test-notify       测试 webhook 推送
 *   --product=8721      只跑某个 productId(调试用)
 *   --dry-run           拉取 + 计算变化 + 打印文案,但不推送
 */

import { PRODUCTS } from './config/products';
import { fetchAll } from './monitors/cigarcab.client';
import { QyWechatNotifier } from './notifier/qywechat';
import { buildAllGroupedMessages, ProductNoticeInput } from './notifier/message-builder';
import { StateStorage } from './storage/state';

function parseArgs(): { testNotify: boolean; product?: number; dryRun: boolean } {
  const args = process.argv.slice(2);
  const productArg = args.find((a) => a.startsWith('--product='));
  return {
    testNotify: args.includes('--test-notify'),
    dryRun: args.includes('--dry-run'),
    product: productArg ? Number(productArg.split('=')[1]) : undefined,
  };
}

async function main() {
  const { testNotify, product: filterProductId, dryRun } = parseArgs();
  console.log(`\n========== 烟草比价监控 ${new Date().toLocaleString('zh-CN')} ==========\n`);

  // 测试推送
  if (testNotify) {
    console.log('[main] 测试推送模式');
    const notifier = new QyWechatNotifier();
    if (!notifier.isConfigured()) {
      console.error('[main] 请先配置 QY_WECHAT_WEBHOOK 环境变量');
      process.exit(1);
    }
    await notifier.sendMarkdown(
      `**烟草比价监控测试**\n>这是一条测试通知,收到说明配置成功 ✅\n>时间: ${new Date().toLocaleString('zh-CN')}`
    );
    return;
  }

  // 筛选商品
  const products = filterProductId
    ? PRODUCTS.filter((p) => p.productId === filterProductId)
    : PRODUCTS;
  console.log(`[main] 本次监控 ${products.length} 个商品\n`);

  // 1. 拉取数据
  const { ok, failed } = await fetchAll(products.map((p) => p.productId));
  console.log(`\n[main] 拉取完成: 成功 ${ok.size} / 失败 ${failed.size}\n`);

  // 2. 检测变化
  const state = new StateStorage();
  const toNotify: ProductNoticeInput[] = [];

  for (const product of products) {
    const channels = ok.get(product.productId) || [];
    if (channels.length === 0) {
      console.log(`[diff] ${product.name} (${product.productId}) 无渠道数据`);
      state.commit(product.productId, [], false);
      continue;
    }

    const changes = state.diffChannels(product.productId, channels);

    const inStockCount = channels.filter((c) => c.isInStock === 1).length;
    const changeSummary = changes
      .map((c) => {
        const tags: string[] = [];
        if (c.restocked) tags.push('补货');
        if (c.notifiedTimeChanged) tags.push('补货时间更新');
        return `#${c.channelId}(${tags.join('/')})`;
      })
      .join(' ');
    console.log(
      `[diff] ${product.name} (${product.productId}) 渠道 ${channels.length} | 有货 ${inStockCount} | 变化 ${changes.length}${changeSummary ? ': ' + changeSummary : ''}`
    );

    if (changes.length > 0) {
      toNotify.push({
        productName: product.name,
        productId: product.productId,
        changes,
        allChannels: channels,
      });
    }
  }

  // 3. 按 (商品, 站点, 规格) 分组生成消息
  const messages = buildAllGroupedMessages(toNotify);

  if (messages.length === 0) {
    console.log('\n[main] 无状态变化,不推送');
  } else {
    console.log(`\n[main] ${toNotify.length} 个商品变化,拆分为 ${messages.length} 条消息(粒度: 单商品+单站+单规格)`);

    if (dryRun) {
      messages.forEach((msg, i) => {
        console.log(`\n--- DRY RUN (${i + 1}/${messages.length}) [${msg.groupKey}] ---`);
        console.log(msg.content);
      });
      console.log('--- 预览结束 ---\n');
    } else {
      const notifier = new QyWechatNotifier();
      let okCount = 0;
      let failCount = 0;
      for (let i = 0; i < messages.length; i++) {
        const ok = await notifier.sendMarkdown(messages[i].content);
        if (ok) okCount++;
        else failCount++;
        // 企微机器人限流: 20条/分钟,这里每条间隔 1s 保守留余量
        if (i < messages.length - 1) {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
      console.log(`[main] 推送完成: 成功 ${okCount} / 失败 ${failCount}`);
    }
  }

  // 4. 提交快照(dry-run 也要提交,否则下次还会触发同样变化)
  for (const product of products) {
    const channels = ok.get(product.productId) || [];
    const simplified = channels.map((c) => ({
      id: c.id,
      isInStock: c.isInStock,
      lastNotifiedTime: c.lastNotifiedTime,
    }));
    state.commit(product.productId, simplified, toNotify.some((n) => n.productId === product.productId));
  }

  // 5. 汇总
  console.log('\n========== 汇总 ==========');
  console.log(`有货商品: ${[...ok.values()].filter((chs) => chs.some((c) => c.isInStock === 1)).length} / ${ok.size}`);
  console.log(`拉取失败: ${failed.size}`);
  for (const [id, err] of failed) {
    console.log(`  - ${id}: ${err}`);
  }
  console.log('');
}

main().catch((err) => {
  console.error('[main] 程序异常退出:', err);
  process.exit(1);
});
