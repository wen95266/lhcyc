import { LotteryDB } from '../db/d1-database.js';

// 注意：这些仍然是占位符 URL。
// 您需要将它们替换为真实的数据源 URL。
const LOTTERY_URLS = {
  'HK': 'https://example.com/hk_data.json',
  'XINAO': 'https://example.com/xinao_data.json',
  'LAOAO': 'https://example.com/laoao_data.json',
  'LAOAO_2230': 'https://example.com/laoao_2230_data.json',
};

// 将键盘文本映射到彩票类型
const lotteryTypeMap = {
    '同步 香港': 'HK',
    '同步 新澳': 'XINAO',
    '同步 老澳': 'LAOAO',
    '同步 老澳22:30': 'LAOAO_2230'
};

export const onRequestPost = async ({ request, env }) => {
  const db = new LotteryDB(env.DB);
  const { message } = await request.json();

  if (!message || !message.text) {
    return new Response('OK');
  }

  // 验证管理员身份
  if (message.from.id.toString() !== env.TELEGRAM_ADMIN_ID) {
    return new Response('OK'); // 静默忽略非管理员的消息
  }
  
  const text = message.text;
  const chatId = message.chat.id;
  const botToken = env.TELEGRAM_BOT_TOKEN;

  // 定义管理员键盘菜单
  const adminKeyboard = [
      [{ text: '同步 香港' }, { text: '同步 新澳' }],
      [{ text: '同步 老澳' }, { text: '同步 老澳22:30' }]
  ];

  if (text === '/start') {
    const welcomeMessage = `您好，管理员！请使用下面的菜单进行操作：`;
    await sendMessage(chatId, welcomeMessage, botToken, adminKeyboard);

  } else if (lotteryTypeMap[text]) { // 处理来自键盘的指令
    const lotteryType = lotteryTypeMap[text];
    await sendMessage(chatId, `正在同步 ${lotteryType} 数据...`, botToken);
    
    if (LOTTERY_URLS[lotteryType]) {
      try {
        const response = await fetch(LOTTERY_URLS[lotteryType]);
        if (!response.ok) {
            throw new Error(`获取数据失败: ${response.status} ${response.statusText}`);
        }
        const { data } = await response.json();
        for (const record of data) {
          await db.addRecord(lotteryType, record);
        }
        await sendMessage(chatId, `✅ 同步 ${lotteryType} 数据完成`, botToken);
      } catch(e) {
        await sendMessage(chatId, `❌ 同步 ${lotteryType} 数据失败: ${e.message}`, botToken);
      }
    } else {
        await sendMessage(chatId, `配置中未找到彩票类型: ${lotteryType}`, botToken);
    }

  } else if (text.startsWith('/delete')) { // 保留 /delete 指令
    const recordId = text.split(' ')[1];
    if (!recordId) {
        await sendMessage(chatId, `请提供记录ID。用法: /delete <ID>`, botToken);
        return new Response('OK');
    }
    await db.deleteRecord(recordId);
    await sendMessage(chatId, `记录 ${recordId} 已删除`, botToken);

  } else {
    // 对于未知指令，回复帮助信息并显示键盘
    await sendMessage(chatId, "未知指令。请使用键盘或输入 /start。", botToken, adminKeyboard);
  }

  return new Response('OK');
};

/**
 * 向指定的 Telegram 聊天发送消息
 * @param {string} chatId 聊天ID
 * @param {string} text 要发送的文本
 * @param {string} botToken 机器人Token
 * @param {Array|null} keyboard 键盘布局 (可选)
 */
async function sendMessage(chatId, text, botToken, keyboard = null) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const payload = {
    chat_id: chatId,
    text: text,
  };
  if (keyboard) {
    payload.reply_markup = {
      keyboard: keyboard,
      resize_keyboard: true,  // 让键盘适应屏幕
      one_time_keyboard: false, // 键盘将保持打开状态
    };
  }
  
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
