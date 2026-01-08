import { LotteryDB } from '../db/d1-database.js';

// 将键盘文本映射到彩票类型
const lotteryTypeMap = {
    '同步 香港': 'HK',
    '同步 新澳': 'XINAO',
    '同步 老澳': 'LAOAO',
    '同步 老澳22:30': 'LAOAO_2230'
};

/**
 * 根据彩票类型从环境变量中获取数据源 URL
 * @param {string} lotteryType 彩票类型 (例如: 'XINAO')
 * @param {object} env Cloudflare 环境变量
 * @returns {string|null} 数据源 URL 或 null
 */
function getLotteryUrl(lotteryType, env) {
  // 1. 检查 LOTTERY_URLS 环境变量是否存在
  if (!env.LOTTERY_URLS) {
    console.error('Error: LOTTERY_URLS environment variable not set.');
    return null;
  }

  let lotteryUrls;
  try {
    // 2. 解析存储在环境变量中的 JSON 字符串
    lotteryUrls = JSON.parse(env.LOTTERY_URLS);
  } catch (e) {
    console.error('Error: Failed to parse LOTTERY_URLS JSON string.', e);
    return null; // 如果 JSON 格式错误，则返回 null
  }

  // 3. 从解析的对象中获取特定彩票的 URL
  let url = lotteryUrls[lotteryType];
  if (!url) {
    console.error(`Error: URL for lottery type "${lotteryType}" not found in LOTTERY_URLS.`);
    return null; // 如果没有找到对应类型的 URL，返回 null
  }

  // 4. 动态替换年份
  // 将 URL 中任何独立的四位数字（如 2024, 2025）替换为当前年份。
  const currentYear = new Date().getFullYear().toString();
  url = url.replace(/\b\d{4}\b/g, currentYear);

  return url;
}


export const onRequestPost = async ({ request, env }) => {
  const db = new LotteryDB(env.DB);
  const { message } = await request.json();

  if (!message || !message.text) {
    return new Response('OK');
  }

  // 验证是否是管理员
  if (message.from.id.toString() !== env.TELEGRAM_ADMIN_ID) {
    return new Response('OK');
  }
  
  const text = message.text;
  const chatId = message.chat.id;
  const botToken = env.TELEGRAM_BOT_TOKEN;

  // 定义管理员键盘
  const adminKeyboard = [
      [{ text: '同步 香港' }, { text: '同步 新澳' }],
      [{ text: '同步 老澳' }, { text: '同步 老澳22:30' }]
  ];

  if (text === '/start') {
    const welcomeMessage = `您好，管理员！请使用下面的菜单进行操作：`;
    await sendMessage(chatId, welcomeMessage, botToken, adminKeyboard);

  } else if (lotteryTypeMap[text]) {
    const lotteryType = lotteryTypeMap[text];
    await sendMessage(chatId, `正在同步 ${lotteryType} 数据...`, botToken);
    
    const url = getLotteryUrl(lotteryType, env);
    
    if (url) {
      try {
        const response = await fetch(url);
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
        await sendMessage(chatId, `❌ 未能从 LOTTERY_URLS 环境变量中找到 ${lotteryType} 的有效 URL。请检查配置。`, botToken);
    }

  } else if (text.startsWith('/delete')) {
    const recordId = text.split(' ')[1];
    if (!recordId) {
        await sendMessage(chatId, `请提供记录ID。用法: /delete <ID>`, botToken);
        return new Response('OK');
    }
    await db.deleteRecord(recordId);
    await sendMessage(chatId, `记录 ${recordId} 已删除`, botToken);

  } else {
    await sendMessage(chatId, "未知指令。请使用键盘或输入 /start。", botToken, adminKeyboard);
  }

  return new Response('OK');
};

async function sendMessage(chatId, text, botToken, keyboard = null) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const payload = {
    chat_id: chatId,
    text: text,
  };
  if (keyboard) {
    payload.reply_markup = {
      keyboard: keyboard,
      resize_keyboard: true,
      one_time_keyboard: false,
    };
  }
  
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
