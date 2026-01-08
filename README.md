
# 彩票预测项目

一个基于 Cloudflare Pages 和 D1 数据库的彩票预测应用。

## 功能

- 支持多种彩票的预测
- PWA 应用，可离线使用
- 通过 Telegram 机器人管理数据

## 开发

1. 在 `functions/utils/config.js` 中配置您的彩票 URL 和 Telegram 机器人 Token。
2. 在 `functions/logic/prediction.js` 中实现您的预测逻辑。
3. 使用 `wrangler` 部署到 Cloudflare Pages。
