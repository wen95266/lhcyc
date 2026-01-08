import { LotteryDB } from '../db/d1-database.js';
import { generatePrediction } from '../logic/prediction.js';
import { getSpecialNumber, getZodiac, getWave } from '../logic/utils.js';

// =================================================================================
// 1. 常量与配置
// =================================================================================

const MAIN_KEYBOARD = [[{ text: '🔄 同步数据' }, { text: '🗂️ 查看记录' }], [{ text: '🔮 执行预测' }]];
const LOTTERY_TYPES = { 'HK': '香港', 'XINAO': '新澳', 'LAOAO': '老澳', 'LAOAO_2230': '老澳22:30' };

// =================================================================================
// 2. Bot 核心类 (封装 Telegram API 交互)
// =================================================================================

class Bot {
    constructor(token) {
        this.token = token;
    }

    async apiCall(methodName, payload) {
        const url = `https://api.telegram.org/bot${this.token}/${methodName}`;
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const json = await response.json();
            if (!json.ok) {
                console.error(`Telegram API Error: ${json.description}`);
                throw new Error(`Telegram API Error: ${json.description}`);
            }
            return json.result;
        } catch (error) {
            console.error(`Failed to call Telegram API ${methodName}:`, error);
            throw error;
        }
    }

    sendMessage(chatId, text, replyMarkup = null) {
        return this.apiCall('sendMessage', { chat_id: chatId, text, ...(replyMarkup && { reply_markup: replyMarkup }) });
    }

    editMessageText(chatId, messageId, text, replyMarkup = null) {
        return this.apiCall('editMessageText', { chat_id: chatId, message_id: messageId, text, ...(replyMarkup && { reply_markup: replyMarkup }) });
    }

    deleteMessage(chatId, messageId) {
        return this.apiCall('deleteMessage', { chat_id: chatId, message_id: messageId });
    }

    answerCallbackQuery(callbackQueryId, text = '') {
        return this.apiCall('answerCallbackQuery', { callback_query_id: callbackQueryId, text });
    }
}

// =================================================================================
// 3. Cloudflare Worker 入口
// =================================================================================

export const onRequestPost = async ({ request, env }) => {
    const payload = await request.json();
    const chatId = payload.message?.chat.id || payload.callback_query?.message.chat.id;

    // 安全校验：确保请求来自指定的管理员
    if (!chatId || chatId.toString() !== env.TELEGRAM_ADMIN_ID) {
        return new Response('Unauthorized', { status: 401 });
    }

    // 创建上下文对象，集中管理所有需要的实例和变量
    const context = {
        db: new LotteryDB(env.DB),
        bot: new Bot(env.TELEGRAM_BOT_TOKEN),
        env,
        payload
    };

    // 根据请求类型进行分发
    if (payload.message && payload.message.text) {
        await handleTextMessage(context);
    } else if (payload.callback_query) {
        await handleCallbackQuery(context);
    }

    return new Response('OK');
};

// =================================================================================
// 4. 消息和回调处理器 (路由)
// =================================================================================

const COMMANDS = new Map([
    ['/start', handleStartCommand],
    ['同步数据', handleSelectLottery],
    ['同步提示', handleSelectLottery], // 指令别名
    ['查看记录', handleSelectLottery],
    ['执行预测', handleSelectLottery]
]);

async function handleTextMessage(context) {
    const { message } = context.payload;
    const cleanText = message.text.trim();

    for (const [command, handler] of COMMANDS.entries()) {
        if (cleanText.includes(command)) {
            await handler(context, command);
            return;
        }
    }

    await context.bot.sendMessage(message.chat.id, `🤔 收到未知指令: "${cleanText}"。请使用下方菜单。`);
}

const CALLBACK_ACTIONS = new Map([
    ['sync', handleSync],
    ['view', handleView],
    ['predict', handlePredict],
    ['delete', handleDelete],
    ['close', handleClose]
]);

async function handleCallbackQuery(context) {
    const { callback_query } = context.payload;
    const { message } = callback_query;
    const [action, data] = callback_query.data.split(':');

    await context.bot.answerCallbackQuery(callback_query.id);

    const handler = CALLBACK_ACTIONS.get(action);
    if (handler) {
        await handler({ ...context, data, message });
    } else {
        await context.bot.editMessageText(message.chat.id, message.message_id, '❌ 未知的回调操作。');
    }
}

// =================================================================================
// 5. 具体指令的实现 (业务逻辑)
// =================================================================================

// --- 指令处理 ---
async function handleStartCommand({ bot, payload }) {
    await bot.sendMessage(payload.message.chat.id, '您好，管理员！请选择操作：', { keyboard: MAIN_KEYBOARD, resize_keyboard: true });
}

async function handleSelectLottery(context, command) {
    const actionMap = { '同步数据': 'sync', '同步提示': 'sync', '查看记录': 'view', '执行预测': 'predict' };
    const textMap = { 'sync': '请选择要同步的彩票类型：', 'view': '请选择要查看的彩票类型：', 'predict': '请选择要预测的彩票类型：' };
    const action = actionMap[command];
    await sendLotterySelection(context.bot, context.payload.message.chat.id, action, textMap[action]);
}

// --- 回调处理 ---
async function handleSync({ bot, db, env, data: lotteryType, message }) {
    await bot.editMessageText(message.chat.id, message.message_id, `⏳ 正在同步 ${LOTTERY_TYPES[lotteryType]} 数据...`);
    const url = getLotteryUrl(lotteryType, env);
    if (!url) {
        await bot.editMessageText(message.chat.id, message.message_id, `❌ 未找到 ${lotteryType} 的 URL 配置。`);
        return;
    }
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`API请求失败: ${response.status}`);
        const { data } = await response.json();

        let completedCount = 0;
        for (const record of data) {
            const completedRecord = { ...record };
            if (!completedRecord.zodiac || !completedRecord.wave) {
                const sn = getSpecialNumber(completedRecord.openCode);
                if (sn) {
                    if (!completedRecord.zodiac) {
                        completedRecord.zodiac = getZodiac(sn); completedCount++;
                    }
                    if (!completedRecord.wave) completedRecord.wave = getWave(sn);
                }
            }
            await db.addRecord(lotteryType, completedRecord);
        }

        let feedback = `✅ 同步 ${LOTTERY_TYPES[lotteryType]} 数据完成！共处理 ${data.length} 条记录。`;
        if (completedCount > 0) feedback += `\n🔍 成功补全了 ${completedCount} 条生肖信息。`;
        await bot.editMessageText(message.chat.id, message.message_id, feedback);
    } catch (e) {
        await bot.editMessageText(message.chat.id, message.message_id, `❌ 同步失败: ${e.message}`);
    }
}

async function handleView({ bot, db, data: lotteryType, message }) {
    await bot.deleteMessage(message.chat.id, message.message_id); // 删除选择菜单
    const records = await db.getRecords(lotteryType, 5);
    if (records.length === 0) {
        await bot.sendMessage(message.chat.id, `📭 数据库中没有 ${LOTTERY_TYPES[lotteryType]} 的记录。`);
        return;
    }
    for (const record of records) {
        const text = `类型: ${LOTTERY_TYPES[lotteryType]}\n期数: ${record.expect}\n时间: ${record.openTime}\n号码: ${record.openCode}\n生肖: ${record.zodiac || 'N/A'}\n波色: ${record.wave || 'N/A'}`;
        await bot.sendMessage(message.chat.id, text, { inline_keyboard: [[{ text: '🗑️ 删除', callback_data: `delete:${record.id}` }]] });
    }
}

async function handleDelete({ bot, db, data: recordId, message }) {
    try {
        await db.deleteRecord(Number(recordId));
        await bot.editMessageText(message.chat.id, message.message_id, `✅ 记录 ID: ${recordId} 已成功删除。`);
    } catch (e) {
        await bot.editMessageText(message.chat.id, message.message_id, `❌ 删除记录 ${recordId} 失败: ${e.message}`);
    }
}

async function handlePredict({ bot, db, data: lotteryType, message }) {
    await bot.editMessageText(message.chat.id, message.message_id, `⏳ 正在为 ${LOTTERY_TYPES[lotteryType]} 生成新预测...`);
    try {
        const records = await db.getRecords(lotteryType);
        if (records.length < 10) {
            await bot.editMessageText(message.chat.id, message.message_id, `❌ 数据不足: ${LOTTERY_TYPES[lotteryType]} 的记录少于10条。`);
            return;
        }
        const prediction = generatePrediction(records);
        await db.addPrediction(lotteryType, prediction);

        const summary = `🔮 ${LOTTERY_TYPES[lotteryType]} 新预测已生成！\n\n- 六肖: ${prediction.sixZodiacs.join(', ')}\n- 18码: ${prediction.eighteenNumbers.join(', ')}\n- 主攻: ${prediction.mainWave}\n- 防守: ${prediction.defenseWave}\n- 头数: ${prediction.twoHeads.join(', ')}\n- 尾数: ${prediction.fiveTails.join(', ')}`;
        await bot.editMessageText(message.chat.id, message.message_id, summary);
    } catch (e) {
        await bot.editMessageText(message.chat.id, message.message_id, `❌ 预测失败: ${e.message}`);
    }
}

async function handleClose({ bot, message }) {
    await bot.deleteMessage(message.chat.id, message.message_id);
}

// =================================================================================
// 6. 辅助函数
// =================================================================================

function sendLotterySelection(bot, chatId, actionPrefix, text) {
    const inlineKeyboard = Object.entries(LOTTERY_TYPES).map(([type, name]) => ({ text: name, callback_data: `${actionPrefix}:${type}` }));
    const keyboardGrid = [];
    for (let i = 0; i < inlineKeyboard.length; i += 2) {
        keyboardGrid.push(inlineKeyboard.slice(i, i + 2));
    }
    keyboardGrid.push([{ text: '❌ 关闭', callback_data: 'close:menu' }]);
    return bot.sendMessage(chatId, text, { inline_keyboard: keyboardGrid });
}

function getLotteryUrl(lotteryType, env) {
    try {
        const lotteryUrls = JSON.parse(env.LOTTERY_URLS);
        const url = lotteryUrls[lotteryType];
        // 自动替换年份
        return url ? url.replace(/\b\d{4}\b/g, new Date().getFullYear().toString()) : null;
    } catch (e) {
        console.error('Error parsing LOTTERY_URLS:', e);
        return null;
    }
}
