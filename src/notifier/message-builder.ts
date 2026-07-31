/**
 * 通知文案生成
 *
 * 通知粒度: 单个商品 + 单个网站 + 单个规格 = 1 条消息
 *   分组键: (productId, sourceSite, spec, unit)
 *   任一渠道在该组内发生变化(补货 / 补货时间更新) → 该组发 1 条消息
 *   组内多个渠道同时变化,合并到同一消息内展示
 *
 * 消息内容: 只报变化的渠道, 不展示同组其他未变化渠道, 也不做跨站比价
 */

import { ChannelRecord } from '../monitors/cigarcab.client';
import { ChannelChange } from '../storage/state';

/** 单个商品的文案输入 */
export interface ProductNoticeInput {
  /** 商品配置中的中文名 */
  productName: string;
  /** cigar.cab 的 productId */
  productId: number;
  /** 发生变化的渠道(及其变化类型) */
  changes: ChannelChange[];
  /** 本次拉取的全部渠道记录(用于在文案末尾列出当前有货渠道,便于下单) */
  allChannels: ChannelRecord[];
}

/** 站点名映射(对应 project_memory 中的约定) */
const SITE_NAME_MAP: Record<string, string> = {
  'tobaccolifestyle.com': '生活站',
  'smokingpipes.com': 'SP站',
  'pipeuncle.com': '茄营站',
};

/** 把 sourceSite 域名映射成中文站名,未命中则原样返回 */
function siteName(sourceSite: string): string {
  return SITE_NAME_MAP[sourceSite] || sourceSite;
}

/** 格式化规格:spec + unit,容错 null */
function formatSpec(spec: string | null, unit: string | null): string {
  if (!spec && !unit) return '规格未知';
  return `${spec || ''} ${unit || ''}`.trim();
}

/** 格式化价格 + 币种 */
function formatPrice(price: number, currency: string): string {
  if (!price && price !== 0) return '价格未知';
  const symbol = currency === 'USD' ? '$' : currency === 'HKD' ? 'HK$' : '';
  return `${symbol}${price} ${currency}`.trim();
}

/** 格式化库存状态 */
function formatStock(isInStock: number): string {
  return isInStock === 1 ? '✅有货' : '❌缺货';
}

/** 分组键: (productId, sourceSite, spec, unit) */
function groupKey(productId: number, ch: ChannelRecord): string {
  return `${productId}::${ch.sourceSite}::${ch.spec || ''}::${ch.unit || ''}`;
}

/** 单条消息(对应一个分组) */
export interface NoticeMessage {
  /** 分组键(调试用) */
  groupKey: string;
  /** markdown 文案 */
  content: string;
}

/**
 * 把一个 productId 的变化,按 (site, spec) 分组,生成 N 条独立消息。
 *
 * 同组内多个变化渠道合并到一条消息。
 * 未发生变化的分组不发消息。
 */
export function buildGroupedMessages(input: ProductNoticeInput): NoticeMessage[] {
  const { productName, productId, changes, allChannels } = input;
  const messages: NoticeMessage[] = [];

  // 按 (sourceSite, spec, unit) 分组 changes
  const groups = new Map<string, ChannelChange[]>();
  for (const change of changes) {
    const ch = allChannels.find((c) => c.id === change.channelId);
    if (!ch) continue;
    const key = groupKey(productId, ch);
    const list = groups.get(key) || [];
    list.push(change);
    groups.set(key, list);
  }

  // 每个分组生成一条消息
  for (const [key, groupChanges] of groups) {
    const lines: string[] = [];
    // 取组内第一条 channel 拿 site/spec 信息(用于标题)
    const firstCh = allChannels.find((c) => c.id === groupChanges[0].channelId);
    if (!firstCh) continue;

    const siteLabel = siteName(firstCh.sourceSite);
    const specLabel = formatSpec(firstCh.spec, firstCh.unit);

    lines.push(`**📦 ${productName} - ${siteLabel} - ${specLabel}**`);

    // 组内每个变化渠道一段
    for (const change of groupChanges) {
      const ch = allChannels.find((c) => c.id === change.channelId);
      if (!ch) continue;

      const reasons: string[] = [];
      if (change.restocked) reasons.push('补货 ✅');
      if (change.notifiedTimeChanged) reasons.push('补货时间更新');
      lines.push(`> ${reasons.join(' / ')}`);
      lines.push(`> ${ch.productName}`);
      lines.push(`> ${formatSpec(ch.spec, ch.unit)} | ${formatPrice(ch.price, ch.currency)} | ${formatStock(ch.isInStock)}`);
      if (ch.lastNotifiedTime) {
        lines.push(`> 补货时间: ${ch.lastNotifiedTime}`);
      }
      lines.push(`> [购买链接](${ch.productUrl})`);
      lines.push('');
    }

    messages.push({
      groupKey: key,
      content: lines.join('\n'),
    });
  }

  return messages;
}

/** 把所有商品的所有分组消息汇总成一个扁平列表(供 index.ts 逐条发送) */
export function buildAllGroupedMessages(inputs: ProductNoticeInput[]): NoticeMessage[] {
  const all: NoticeMessage[] = [];
  for (const input of inputs) {
    all.push(...buildGroupedMessages(input));
  }
  return all;
}
