import { LotteryDB } from '../db/d1-database';

async function handleUpdate(update, env) {
  const { message } = update;
  if (!message || !message.text) return;

  const fromId = message.from.id.toString();
  // Directly use TELEGRAM_ADMIN_ID from environment variables
  if (fromId !== env.TELEGRAM_ADMIN_ID) {
    return; // Only process messages from the admin
  }

  const text = message.text.toLowerCase();
  const db = new LotteryDB(env.DB);

  // Parse LOTTERY_URLS from environment variables
  const LOTTERY_URLS = JSON.parse(env.LOTTERY_URLS);

  if (text.startsWith('/sync')) {
    const lotteryType = text.split(' ')[1];
    if (LOTTERY_URLS[lotteryType]) {
      const response = await fetch(LOTTERY_URLS[lotteryType]);
      const { data } = await response.json();
      for (const record of data) {
        await db.addRecord(lotteryType, record);
      }
      await sendMessage(message.chat.id, `同步 ${lotteryType} 数据完成`, env.TELEGRAM_BOT_TOKEN);
    }
  } else if (text.startsWith('/delete')) {
    const recordId = text.split(' ')[1];
    await db.deleteRecord(recordId);
    await sendMessage(message.chat.id, `删除记录 ${recordId} 完成`, env.TELEGRAM_BOT_TOKEN);
  }
}

async function sendMessage(chatId, text, botToken) {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: text }),
    });
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'POST') {
    const update = await request.json();
    await handleUpdate(update, env);
  }
  return new Response('OK');
}
