/**
 * 状态去重存储
 * 记录每个商品上次的库存状态,避免同一商品有货期间重复推送
 * 本地使用 state.json 文件持久化,GitHub Actions 中使用 actions cache 或每次重新判断
 */

import * as fs from 'fs';
import * as path from 'path';

const STATE_FILE = path.resolve(process.cwd(), 'state.json');

/** 单个商品的状态记录 */
interface ProductState {
  /** 是否有货 */
  inStock: boolean;
  /** 上次通知时间戳(ms) */
  lastNotifyAt: number;
  /** 上次检查时间戳(ms) */
  lastCheckAt: number;
}

/** 全部商品状态: { [productKey]: ProductState } */
type StateMap = Record<string, ProductState>;

export class StateStorage {
  private state: StateMap = {};

  constructor() {
    this.load();
  }

  /** 从本地文件加载状态 */
  private load() {
    try {
      if (fs.existsSync(STATE_FILE)) {
        const raw = fs.readFileSync(STATE_FILE, 'utf-8');
        this.state = JSON.parse(raw);
      }
    } catch (err) {
      console.warn('[state] 状态文件读取失败,将使用空状态:', err instanceof Error ? err.message : err);
      this.state = {};
    }
  }

  /** 保存状态到本地文件 */
  private save() {
    try {
      fs.writeFileSync(STATE_FILE, JSON.stringify(this.state, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[state] 状态文件保存失败:', err instanceof Error ? err.message : err);
    }
  }

  /**
   * 判断是否需要通知
   * 规则:上次无货/无记录 → 这次有货 = 需要通知
   *       上次有货 → 这次有货 = 不通知(避免重复打扰)
   */
  shouldNotify(productKey: string, currentInStock: boolean): boolean {
    const prev = this.state[productKey];
    // 首次检查 或 上次无货,现在有货
    if (!prev || (!prev.inStock && currentInStock)) {
      return true;
    }
    return false;
  }

  /**
   * 更新商品状态
   */
  update(productKey: string, inStock: boolean, notified: boolean) {
    const now = Date.now();
    this.state[productKey] = {
      inStock,
      lastNotifyAt: notified ? now : this.state[productKey]?.lastNotifyAt ?? 0,
      lastCheckAt: now,
    };
    this.save();
  }

  /** 获取某商品上次状态(调试用) */
  get(productKey: string): ProductState | undefined {
    return this.state[productKey];
  }
}
