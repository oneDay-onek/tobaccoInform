/**
 * 敏感信息读取:统一从环境变量获取,本地调试时可写入 .env 文件
 */

/** 企业微信群机器人 webhook URL */
export function getQyWechatWebhook(): string {
  const url = process.env.QY_WECHAT_WEBHOOK || '';
  if (!url) {
    console.warn('[config] 未配置 QY_WECHAT_WEBHOOK 环境变量,推送功能将跳过');
  }
  return url;
}
