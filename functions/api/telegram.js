import { LotteryDB } from '../db/d1-database.js';
import { generatePrediction } from '../logic/prediction.js';
import { getSpecialNumber, getZodiac, getWave } from '../logic/utils.js';

// 1. 全局常量和配置
const MAIN_KEYBOARD = [
    [{ text: '🔄 同步数据' }, { text: '🗂️ 查看记录' }],
    [{ text: '🔮 执行预测' }]
];

const LOTTERY_TYPES = {
    'HK': '香港',
    'XINAO': '新澳',
    'LAOAO': '老澳'
};

// 2. 核心请求处理
export const onRequestPost = async ({ request, env }) => {
    const payload = await request.json();
    const db = new LotteryDB(env.DB);
    const adminId = env.TELEGRAM_ADMIN_ID;
    const botToken = env.TELEGRAM_BOT_TOKEN;
    const chatId = payload.message?.chat.id || payload.callback_query?.message.chat.id;

    if (!chatId || chatId.toString() !== adminId) {
        return new Response('Unauthorized', { status: 401 });
    }

    if (payload.message && payload.message.text) {
        await handleTextMessage(payload.message, db, env);
    } else if (payload.callback_query) {
        await handleCallbackQuery(payload.callback_query, db, env);
    }

    return new Response('OK');
};

// 3. 消息和回调处理器
async function handleTextMessage(message, db, env) {
    const { text, chat: { id: chatId } } = message;

    switch (text) {
        case '/start':
            await sendMessage(chatId, '您好，管理员！请选择操作：', env.TELEGRAM_BOT_TOKEN, { reply_markup: { keyboard: MAIN_KEYBOARD, resize_keyboard: true } });
            break;
        case '🔄 同步数据':
            await sendLotterySelection(chatId, 'sync', '请选择要同步的彩票类型：', env.TELEGRAM_BOT_TOKEN);
            break;
        case '🗂️ 查看记录':
            await sendLotterySelection(chatId, 'view', '请选择要查看的彩票类型：', env.TELEGRAM_BOT_TOKEN);
            break;
        case '🔮 执行预测':
            await sendLotterySelection(chatId, 'predict', '请选择要为其生成预测的彩票类型：', env.TELEGRAM_BOT_TOKEN);
            break;
        default:
            await sendMessage(chatId, '未知指令。', env.TELEGRAM_BOT_TOKEN);
            break;
    }
}

async function handleCallbackQuery(callbackQuery, db, env) {
    const [action, data] = callbackQuery.data.split(':');
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;

    await answerCallbackQuery(callbackQuery.id, env.TELEGRAM_BOT_TOKEN);
    await editMessageText(chatId, messageId, `正在处理您的 ${action} 请求...`, env.TELEGRAM_BOT_TOKEN);

    switch (action) {
        case 'sync':
            await handleSync(chatId, data, db, env, messageId);
            break;
        case 'view':
            await deleteMessage(chatId, messageId, env.TELEGRAM_BOT_TOKEN);
            await handleView(chatId, data, db, env);
            break;
        case 'predict':
            await handlePredict(chatId, data, db, env, messageId);
            break;
        case 'delete':
            await handleDelete(chatId, messageId, data, db, env);
            break;
        case 'close':
            await deleteMessage(chatId, messageId, env.TELEGRAM_BOT_TOKEN);
            break;
    }
}

// 4. 功能实现
async function handleSync(chatId, lotteryType, db, env, messageId) {
    const url = getLotteryUrl(lotteryType, env);
    if (!url) {
        await editMessageText(chatId, messageId, `❌ 未找到 ${lotteryType} 的 URL 配置。`, env.TELEGRAM_BOT_TOKEN);
        return;
    }
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`API请求失败，状态码: ${response.status}`);
        const { data } = await response.json();

        let completedCount = 0;
        for (const record of data) {
            const completedRecord = { ...record };

            // 如果生肖或波色为空，则尝试补全
            if (!completedRecord.zodiac || !completedRecord.wave) {
                const specialNumber = getSpecialNumber(completedRecord.openCode);
                if (specialNumber) {
                    if (!completedRecord.zodiac) {
                        completedRecord.zodiac = getZodiac(specialNumber);
                        completedCount++;
                    }
                    if (!completedRecord.wave) {
                        completedRecord.wave = getWave(specialNumber);
                    }
                }
            }
            await db.addRecord(lotteryType, completedRecord);
        }
        
        let feedback = `✅ 同步 ${LOTTERY_TYPES[lotteryType]} 数据完成！`;
        if (completedCount > 0) {
            feedback += `\n🔍 成功为 ${completedCount} 条记录补全了缺失的生肖信息。`;
        }
        await editMessageText(chatId, messageId, feedback, env.TELEGRAM_BOT_TOKEN);

    } catch (e) {
        await editMessageText(chatId, messageId, `❌ 同步失败: ${e.message}`, env.TELEGRAM_BOT_TOKEN);
    }
}


async function handleView(chatId, lotteryType, db, env) {
    const records = await db.getRecords(lotteryType, 5);
    if (records.length === 0) {
        await sendMessage(chatId, `数据库中没有 ${LOTTERY_TYPES[lotteryType]} 的记录。`, env.TELEGRAM_BOT_TOKEN);
        return;
    }
    for (const record of records) {
        const messageText = `类型: ${LOTTERY_TYPES[lotteryType]}\n期数: ${record.expect}\n时间: ${record.openTime}\n号码: ${record.openCode}\n生肖: ${record.zodiac || 'N/A'}\n波色: ${record.wave || 'N/A'}`;
        const inlineKeyboard = [[{ text: '🗑️ 删除', callback_data: `delete:${record.id}` }]];
        await sendMessage(chatId, messageText, env.TELEGRAM_BOT_TOKEN, { inline_keyboard: inlineKeyboard });
    }
}

async function handleDelete(chatId, messageId, recordId, db, env) {
    try {
        await db.deleteRecord(recordId);
        await editMessageText(chatId, messageId, `✅ 记录 ID: ${recordId} 已成功删除。`, env.TELEGRAM_BOT_TOKEN);
    } catch (e) {
        await editMessageText(chatId, messageId, `❌ 删除失败: ${e.message}`, env.TELEGRAM_BOT_TOKEN);
    }
}

async function handlePredict(chatId, lotteryType, db, env, messageId) {
    try {
        const records = await db.getRecords(lotteryType);
        if (records.length < 10) {
            await editMessageText(chatId, messageId, `❌ 数据不足: ${LOTTERY_TYPES[lotteryType]} 的记录少于10条，无法生成有效预测。`, env.TELEGRAM_BOT_TOKEN);
            return;
        }

        const prediction = generatePrediction(records);
        await db.addPrediction(lotteryType, prediction);
        
        const summary = `
🔮 ${LOTTERY_TYPES[lotteryType]} 新预测已生成！

- 六肖: ${prediction.sixZodiacs.join(', ')}
- 18码: ${prediction.eighteenNumbers.join(', ')}
- 主攻: ${prediction.mainWave}
- 防守: ${prediction.defenseWave}
- 头数: ${prediction.twoHeads.join(', ')}
- 尾数: ${prediction.fiveTails.join(', ')}
        `;

        await editMessageText(chatId, messageId, summary, env.TELEGRAM_BOT_TOKEN);

    } catch (e) {
        await editMessageText(chatId, messageId, `❌ 预测生成失败: ${e.message}`, env.TELEGRAM_BOT_TOKEN);
    }
}


// 5. 辅助函数
async function sendLotterySelection(chatId, actionPrefix, text, botToken) {
    const inlineKeyboard = Object.entries(LOTTERY_TYPES).map(([type, name]) => ({
        text: name,
        callback_data: `${actionPrefix}:${type}`
    }));
    const keyboardGrid = [];
    for (let i = 0; i < inlineKeyboard.length; i += 2) {
        keyboardGrid.push(inlineKeyboard.slice(i, i + 2));
    }
    keyboardGrid.push([{ text: '❌ 关闭', callback_data: 'close:menu' }]);
    await sendMessage(chatId, text, botToken, { inline_keyboard: keyboardGrid });
}

function getLotteryUrl(lotteryType, env) {
    try {
        const lotteryUrls = JSON.parse(env.LOTTERY_URLS);
        const url = lotteryUrls[lotteryType];
        return url ? url.replace(/\b\d{4}\b/g, new Date().getFullYear().toString()) : null;
    } catch (e) {
        console.error('Error parsing LOTTERY_URLS:', e);
        return null;
    }
}

async function apiCall(botToken, methodName, payload) {
    const url = `https://api.telegram.org/bot${botToken}/${methodName}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    return response.json();
}

async function sendMessage(chatId, text, botToken, replyMarkup = null) {
    return apiCall(botToken, 'sendMessage', { chat_id: chatId, text, ...(replyMarkup && { reply_markup: replyMarkup }) });
}

async function editMessageText(chatId, messageId, text, botToken, replyMarkup = null) {
    return apiCall(botToken, 'editMessageText', { chat_id: chatId, message_id: messageId, text, ...(replyMarkup && { reply_markup: replyMarkup }) });
}

async function deleteMessage(chatId, messageId, botToken) {
    return apiCall(botToken, 'deleteMessage', { chat_id: chatId, message_id: messageId });
}

async function answerCallbackQuery(callbackQueryId, botToken) {
    return apiCall(botToken, 'answerCallbackQuery', { callback_query_id: callbackQueryId });
}
