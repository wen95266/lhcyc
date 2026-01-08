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
  const year = new Date().getFullYear();
  let url;

  switch (lotteryType) {
    case 'XINAO':
      // 新澳彩使用动态年份链接
      url = env.XINAO_URL_TEMPLATE || 'https://history.macaumarksix.com/history/macaujc2/y/${year}';
      return url.replace('${year}', year);
    case 'HK':
      url = env.HK_URL;
      break;
    case 'LAOAO':
      url = env.LAOAO_URL;
      break;
    case 'LAOAO_2230':
      url = env.LAOAO_2230_URL;
      break;
    default:
      return null;
  }

  // 对于非动态链接，如果配置了年份模板，也进行替换
  if (url && url.includes('${year}')) {
      return url.replace('${year}', year);
  }
  return url;
}

export const onRequestPost = async ({ request, env }) => {
  const db = new LotteryDB(env.DB);
  const { message } = await request.json();

  if (!message || !message.text) {
    return new Response('OK');
  }

  if (message.from.id.toString() !== env.TELEGRAM_ADMIN_ID) {
    return new Response('OK');
  }
  
  const text = message.text;
  const chatId = message.chat.id;
  const botToken = env.TELEGRAM_BOT_TOKEN;

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
    
    // 将 env 对象传递给 getLotteryUrl
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
        await sendMessage(chatId, `❌ 未在环境变量中配置 ${lotteryType} 的 URL。`, botToken);
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
