/**
 * 企业微信群机器人推送
 * 通过 webhook 发送文本/markdown 消息到企微群
 * 文档:https://developer.work.weixin.qq.com/document/path/91770
 */

import axios from 'axios';
import { getQyWechatWebhook } from '../config/secrets';

type MessageType = 'markdown' | 'text';

export class QyWechatNotifier {
  private webhook: string;

  constructor() {
    this.webhook = getQyWechatWebhook();
  }

  /** 是否已配置 webhook */
  isConfigured(): boolean {
    return !!this.webhook;
  }

  /**
   * 发送 markdown 消息
   * 适合富文本通知,支持加粗、链接等
   */
  async sendMarkdown(content: string): Promise<boolean> {
    if (!this.isConfigured()) {
      console.log('[notifier] webhook 未配置,跳过推送');
      return false;
    }

    try {
      const resp = await axios.post(
        this.webhook,
        {
          msgtype: 'markdown',
          markdown: { content },
        },
        {
          timeout: 10000,
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (resp.data?.errcode === 0) {
        console.log('[notifier] 推送成功');
        return true;
      } else {
        console.error('[notifier] 推送失败:', resp.data);
        return false;
      }
    } catch (err) {
      console.error('[notifier] 推送异常:', err instanceof Error ? err.message : err);
      return false;
    }
  }

  /**
   * 发送文本消息
   */
  async sendText(content: string): Promise<boolean> {
    if (!this.isConfigured()) {
      console.log('[notifier] webhook 未配置,跳过推送');
      return false;
    }

    try {
      const resp = await axios.post(
        this.webhook,
        {
          msgtype: 'text',
          text: { content },
        },
        {
          timeout: 10000,
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (resp.data?.errcode === 0) {
        console.log('[notifier] 推送成功');
        return true;
      } else {
        console.error('[notifier] 推送失败:', resp.data);
        return false;
      }
    } catch (err) {
      console.error('[notifier] 推送异常:', err instanceof Error ? err.message : err);
      return false;
    }
  }
}
