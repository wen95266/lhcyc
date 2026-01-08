import { LotteryDB } from '../db/d1-database.js';

// Dummy URLs - these need to be configured properly
const LOTTERY_URLS = {
  // These should be real URLs or configured via environment variables
  'HK': 'https://example.com/hk_data.json',
  'XINAO': 'https://example.com/xinao_data.json',
  'LAOAO': 'https://example.com/laoao_data.json',
};

export const onRequestPost = async ({ request, env }) => {
  const db = new LotteryDB(env.DB);
  const { message } = await request.json();

  if (message && message.text) {
    // Authenticate the user
    if (message.from.id.toString() === env.TELEGRAM_ADMIN_ID) {
      const text = message.text;

      if (text === '/start') {
        const welcomeMessage = `您好，管理员！欢迎使用您的彩票机器人。

可用指令：
- /sync <TYPE> - 同步彩票数据 (例如: /sync HK)
- /delete <ID> - 按ID删除记录`;
        await sendMessage(message.chat.id, welcomeMessage, env.TELEGRAM_BOT_TOKEN);
      } else if (text.startsWith('/sync')) {
        const lotteryType = text.split(' ')[1];
        if (LOTTERY_URLS[lotteryType]) {
          try {
            const response = await fetch(LOTTERY_URLS[lotteryType]);
            // Check if the response is ok (status in the range 200-299)
            if (!response.ok) {
                throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
            }
            const { data } = await response.json();
            for (const record of data) {
              await db.addRecord(lotteryType, record);
            }
            await sendMessage(message.chat.id, `同步 ${lotteryType} 数据完成`, env.TELEGRAM_BOT_TOKEN);
          } catch(e) {
            await sendMessage(message.chat.id, `同步 ${lotteryType} 数据失败: ${e.message}`, env.TELEGRAM_BOT_TOKEN);
          }
        } else {
            await sendMessage(message.chat.id, `未知的彩票类型: ${lotteryType}`, env.TELEGRAM_BOT_TOKEN);
        }
      } else if (text.startsWith('/delete')) {
        const recordId = text.split(' ')[1];
        await db.deleteRecord(recordId);
        await sendMessage(message.chat.id, `删除记录 ${recordId} 完成`, env.TELEGRAM_BOT_TOKEN);
      } else {
        // Add a fallback for unknown commands
        await sendMessage(message.chat.id, "未知指令。请输入 /start 查看可用指令。", env.TELEGRAM_BOT_TOKEN);
      }
    }
  }

  return new Response('OK');
};

async function sendMessage(chatId, text, botToken) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: text }),
  });
}
