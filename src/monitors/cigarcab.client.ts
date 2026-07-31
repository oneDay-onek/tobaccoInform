/**
 * cigar.cab 聚合 API 客户端
 *
 *   GET https://cigar.cab/api/products/{productId}/channels
 *
 * 无鉴权、无签名,但需保持礼貌请求频率(并发拉取,限制最大并发数)。
 * 字段说明见 交接文档.md 第 2.2 节。
 */

import axios, { AxiosInstance } from 'axios';

/** 单条渠道记录(API 返回数组的一项) */
export interface ChannelRecord {
  /** 渠道记录 ID(同一 productId 下唯一,用作状态存储 key) */
  id: number;
  /** 品牌(各站叫法不一,可能为 null) */
  brand: string | null;
  /** 商品名(各站叫法不一) */
  productName: string;
  /** 规格(多为 null) */
  specification: string | null;
  /** 规格数值 */
  spec: string | null;
  /** 单位 */
  unit: string | null;
  /** 价格 */
  price: number;
  /** 币种:USD / HKD 等 */
  currency: string;
  /** 库存:1=有货, 0=缺货 */
  isInStock: number;
  /** 是否已通知 */
  isNotified: number;
  /** 最近补货通知时间(可能为 null) */
  lastNotifiedTime: string | null;
  /** 推荐分(1-4) */
  recommendScore: number | null;
  /** 源站购买链接 */
  productUrl: string;
  /** 源站域名 */
  sourceSite: string;
  /** 站点分类 */
  tag: string | null;
}

const BASE_URL = 'https://cigar.cab';
/** 最大并发数,避免一次性发太多请求触发限流 */
const MAX_CONCURRENCY = 5;

/** 单次拉取某个 productId 的全部渠道记录 */
export async function fetchChannels(productId: number): Promise<ChannelRecord[]> {
  const client: AxiosInstance = axios.create({
    baseURL: BASE_URL,
    timeout: 15000,
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0',
      Referer: `${BASE_URL}/`,
    },
  });

  const resp = await client.get<ChannelRecord[]>(`/api/products/${productId}/channels`);
  return resp.data || [];
}

/** 并发拉取多个 productId,限制最大并发数。失败的 ID 记录到 failed 返回。 */
export async function fetchAll(
  productIds: number[]
): Promise<{ ok: Map<number, ChannelRecord[]>; failed: Map<number, string> }> {
  const ok = new Map<number, ChannelRecord[]>();
  const failed = new Map<number, string>();

  // 简单分批:把 productIds 切成 MAX_CONCURRENCY 一组,组内并发,组间串行
  for (let i = 0; i < productIds.length; i += MAX_CONCURRENCY) {
    const batch = productIds.slice(i, i + MAX_CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (id) => {
        try {
          const channels = await fetchChannels(id);
          return { id, channels, error: null as string | null };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return { id, channels: [] as ChannelRecord[], error: msg };
        }
      })
    );

    for (const r of results) {
      if (r.error) {
        console.error(`[cigarcab] ${r.id} FAIL - ${r.error}`);
        failed.set(r.id, r.error);
      } else {
        console.log(`[cigarcab] ${r.id} OK (${r.channels.length} 渠道)`);
        ok.set(r.id, r.channels);
      }
    }
  }

  return { ok, failed };
}
