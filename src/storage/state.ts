/**
 * 状态去重存储
 *
 * 由于切换到 cigar.cab 聚合 API,状态粒度改为:
 *   key = productId
 *   value = { 各渠道的 (isInStock, lastNotifiedTime) 快照 }
 *
 * 触发通知的条件(任一渠道满足即触发):
 *   1. isInStock: 0 → 1  (无货→有货)
 *   2. lastNotifiedTime: 变化且非 null  (cigar.cab 标记的补货事件)
 */

import * as fs from 'fs';
import * as path from 'path';

const STATE_FILE = path.resolve(process.cwd(), 'state.json');

/** 单个渠道的快照状态 */
export interface ChannelSnapshot {
  /** 0=缺货, 1=有货 */
  isInStock: number;
  /** cigar.cab 标记的最近补货通知时间(可能为 null) */
  lastNotifiedTime: string | null;
}

/** 单个商品的状态记录 */
interface ProductState {
  /** 各渠道快照,key 为 channel.id(字符串化) */
  channels: Record<string, ChannelSnapshot>;
  /** 上次触发通知的时间戳(ms) */
  lastNotifyAt: number;
  /** 上次检查时间戳(ms) */
  lastCheckAt: number;
}

/** 全部商品状态: { [productId]: ProductState } (JSON 中 key 为字符串) */
type StateMap = Record<string, ProductState>;

/** 渠道变化描述(用于文案生成) */
export interface ChannelChange {
  /** 渠道 ID */
  channelId: number;
  /** 0→1 触发 */
  restocked: boolean;
  /** lastNotifiedTime 变化触发 */
  notifiedTimeChanged: boolean;
  /** 旧值 */
  prev?: ChannelSnapshot;
  /** 新值 */
  curr: ChannelSnapshot;
}

export class StateStorage {
  private state: StateMap = {};

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(STATE_FILE)) {
        const raw = fs.readFileSync(STATE_FILE, 'utf-8');
        this.state = JSON.parse(raw);
      }
    } catch (err) {
      console.warn(
        '[state] 状态文件读取失败,将使用空状态:',
        err instanceof Error ? err.message : err
      );
      this.state = {};
    }
  }

  private save() {
    try {
      fs.writeFileSync(STATE_FILE, JSON.stringify(this.state, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[state] 状态文件保存失败:', err instanceof Error ? err.message : err);
    }
  }

  /**
   * 对比某 productId 当前各渠道状态与上次快照,返回发生变化的渠道列表。
   *
   * 变化定义(任一满足即视为变化):
   *   - isInStock: 0 → 1
   *   - lastNotifiedTime: 旧值不同(且新值非 null,旧值不限制)
   *
   * 首次检查该渠道时:若 isInStock=1 或 lastNotifiedTime 非 null,也视为变化(触发首次通知)。
   */
  diffChannels(
    productId: number,
    current: Array<{ id: number; isInStock: number; lastNotifiedTime: string | null }>
  ): ChannelChange[] {
    const prevProduct = this.state[String(productId)];
    const prevChannels = prevProduct?.channels || {};
    const changes: ChannelChange[] = [];

    for (const ch of current) {
      const prev = prevChannels[String(ch.id)];
      const curr: ChannelSnapshot = {
        isInStock: ch.isInStock,
        lastNotifiedTime: ch.lastNotifiedTime,
      };

      let restocked = false;
      let notifiedTimeChanged = false;

      if (!prev) {
        // 首次见到的渠道:不触发任何通知,只建立基线快照。
        // 因为"当前有货"不代表"刚刚补货",可能是历史补货还在售。
        // 真正的补货事件要等下次 isInStock 0→1 或 lastNotifiedTime 变化才触发。
        restocked = false;
        notifiedTimeChanged = false;
      } else {
        // 0→1 才算补货(1→1 持续有货不触发,符合"持续未售空不重复提示"的要求)
        restocked = prev.isInStock === 0 && ch.isInStock === 1;
        notifiedTimeChanged =
          ch.lastNotifiedTime !== null && ch.lastNotifiedTime !== prev.lastNotifiedTime;
      }

      if (restocked || notifiedTimeChanged) {
        changes.push({
          channelId: ch.id,
          restocked,
          notifiedTimeChanged,
          prev,
          curr,
        });
      }
    }

    return changes;
  }

  /** 提交本次检查的快照(覆盖式更新该 productId 的全部渠道状态) */
  commit(
    productId: number,
    current: Array<{ id: number; isInStock: number; lastNotifiedTime: string | null }>,
    notified: boolean
  ) {
    const now = Date.now();
    const channels: Record<string, ChannelSnapshot> = {};
    for (const ch of current) {
      channels[String(ch.id)] = {
        isInStock: ch.isInStock,
        lastNotifiedTime: ch.lastNotifiedTime,
      };
    }
    const prev = this.state[String(productId)];
    this.state[String(productId)] = {
      channels,
      lastNotifyAt: notified ? now : prev?.lastNotifyAt ?? 0,
      lastCheckAt: now,
    };
    this.save();
  }

  /** 调试用:读取某 productId 状态 */
  get(productId: number): ProductState | undefined {
    return this.state[String(productId)];
  }
}
