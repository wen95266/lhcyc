/**
 * =================================================================================
 * Telegram Bot API 入口 & 核心交互逻辑 V3.0
 * =================================================================================
 * 变更日志:
 * - V3.0: 全面重构，与重写后的 DB/Logic 层完全集成。
 * - V3.0: 新增 "查看最新预测" 功能，与 "生成新预测" 分离，优化用户体验。
 * - V3.0: 强化数据同步逻辑，强制对入库数据进行清洗和标准化。
 * - V3.0: 全面采用参数化查询和详细的错误处理，提升健壮性。
 * =================================================================================
 */

import { LotteryDB } from '../db/d1-database.js';
import { generatePrediction } from '../logic/prediction.js';
import { getSpecialNumber, getZodiac, getWave, WAVE_TRANSLATION_MAP } from '../logic/utils.js';

// --- Bot UI 定义 ---
const MAIN_KEYBOARD = [
    [{ text: '🔄 同步数据' }],
    [{ text: '🗂️ 查看记录' }, { text: '📈 查看预测' }],
    [{ text: '🔮 生成新预测' }]
];
const LOTTERY_TYPES = { 'HK': '香港', 'XINAO': '新澳', 'LAOAO': '老澳' };

// --- Bot API 封装 ---
class Bot {
    constructor(token) { this.token = token; }
    async apiCall(method, payload) {
        const resp = await fetch(`https://api.telegram.org/bot${this.token}/${method}`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(payload) 
        });
        const json = await resp.json();
        if (!json.ok) console.error(`Telegram API Error [${method}]:`, json.description);
        return json;
    }
    sendMessage(chat, text, markup = {}) { return this.apiCall('sendMessage', { chat_id: chat, text, ...markup, parse_mode: 'Markdown' }); }
    editMessageText(chat, msgId, text, markup = {}) { return this.apiCall('editMessageText', { chat_id: chat, message_id: msgId, text, ...markup, parse_mode: 'Markdown' }); }
    deleteMessage(chat, msgId) { return this.apiCall('deleteMessage', { chat_id: chat, message_id: msgId }); }
    answerCallback(id, text = null) { return this.apiCall('answerCallbackQuery', { callback_query_id: id, text }); }
}

// --- Cloudflare Worker 入口 ---
export const onRequestPost = async ({ request, env }) => {
    const payload = await request.json();
    const chatId = payload.message?.chat.id || payload.callback_query?.message.chat.id;
    if (!chatId || chatId.toString() !== env.TELEGRAM_ADMIN_ID) return new Response('Unauthorized', { status: 403 });

    const context = { db: new LotteryDB(env.DB), bot: new Bot(env.TELEGRAM_BOT_TOKEN), env, payload };

    try {
        if (payload.message?.text) await handleTextMessage(context);
        else if (payload.callback_query) await handleCallbackQuery(context);
    } catch (e) {
        console.error("Unhandled exception in handler:", e);
        if (chatId) await context.bot.sendMessage(chatId, `🚨 *严重错误* 🚨\n\n处理您的请求时发生意外状况。请检查后台日志。\n\n错误: \`${e.message}\``);
    }

    return new Response('OK');
};

// --- 处理器 ---
async function handleTextMessage({ bot, payload }) {
    const text = payload.message.text.trim();
    const chat = payload.message.chat.id;
    if (text === '/start') await bot.sendMessage(chat, '您好！请选择操作：', { reply_markup: { keyboard: MAIN_KEYBOARD, resize_keyboard: true } });
    else if (text.includes('同步')) await sendLotterySelection(bot, chat, 'sync', '请选择要同步的类型：');
    else if (text.includes('查看记录')) await sendLotterySelection(bot, chat, 'view', '请选择要查看的类型：');
    else if (text.includes('查看预测')) await sendLotterySelection(bot, chat, 'view_pred', '请选择要查看的预测类型：');
    else if (text.includes('生成新预测')) await sendLotterySelection(bot, chat, 'gen_pred', '请选择要生成预测的类型：');
}

async function handleCallbackQuery(ctx) {
    const cq = ctx.payload.callback_query;
    const [action, data] = cq.data.split(':');
    const chat = cq.message.chat.id;
    const msgId = cq.message.message_id;

    await ctx.bot.answerCallback(cq.id);

    const handlers = {
        sync: handleSync,
        view: async (c, d) => { await c.bot.deleteMessage(chat, msgId); await handleView(c, d); },
        gen_pred: handleGeneratePrediction,
        view_pred: handleViewPrediction,
        delete: handleDelete,
        close: (c, d) => c.bot.deleteMessage(chat, msgId),
    };

    if (handlers[action]) await handlers[action](ctx, data, msgId);
}

// --- 核心功能实现 ---
async function handleSync({ bot, db, env }, type, msgId) {
    const url = getLotteryUrl(type, env);
    if (!url) return bot.editMessageText(msgId, `❌ 环境变量 LOTTERY_URLS 配置错误。`);
    
    await bot.editMessageText(chat, msgId, `⏳ 正在从源同步 *${LOTTERY_TYPES[type]}*...`);
    try {
        const response = await fetch(url);
        const { data } = await response.json();
        let successCount = 0;

        for (const record of data) {
            const specialNum = getSpecialNumber(record.openCode);
            if (specialNum) { // 只处理包含有效特码的记录
                // 强制规范化数据
                record.zodiac = (record.zodiac || getZodiac(specialNum) || '').split(',').map(z => z.trim()).join(', ');
                record.wave = getWave(specialNum);
                await db.addRecord(type, record);
                successCount++;
            }
        }
        await bot.editMessageText(chat, msgId, `✅ *${LOTTERY_TYPES[type]}* 同步完成！\n\n成功处理并存储了 ${successCount} / ${data.length} 条记录。`);
    } catch (e) {
        await bot.editMessageText(chat, msgId, `❌ 同步失败: \`${e.message}\``);
    }
}

async function handleGeneratePrediction({ bot, db }, type, msgId) {
    await bot.editMessageText(chat, msgId, `⏳ 正在为 *${LOTTERY_TYPES[type]}* 执行全新高级分析...`);
    try {
        const records = await db.getRecords(type, 100);
        const prediction = generatePrediction(records);

        if (prediction.error) {
            return bot.editMessageText(chat, msgId, `⚠️ *分析中止*: ${prediction.error}`);
        }

        await db.addPrediction(type, prediction);
        const text = formatPredictionText(prediction, LOTTERY_TYPES[type]);
        await bot.editMessageText(chat, msgId, text);
    } catch (e) {
        await bot.editMessageText(chat, msgId, `❌ 预测生成失败: \`${e.message}\``);
    }
}

async function handleViewPrediction({ bot, db }, type, msgId) {
    await bot.editMessageText(chat, msgId, `⏳ 正在查询 *${LOTTERY_TYPES[type]}* 的最新预测...`);
    try {
        const latest = await db.getLatestPrediction(type);
        if (!latest) {
            return bot.editMessageText(chat, msgId, `ℹ️ 未找到 *${LOTTERY_TYPES[type]}* 的任何预测记录。请先生成一个。`);
        }
        const text = formatPredictionText(latest.predictionData, LOTTERY_TYPES[type], latest.createdAt);
        await bot.editMessageText(chat, msgId, text);
    } catch (e) {
        await bot.editMessageText(chat, msgId, `❌ 预测查询失败: \`${e.message}\``);
    }
}

async function handleView({ bot, db }, type) {
    const records = await db.getRecords(type, 5);
    if (records.length === 0) return bot.sendMessage(chat, `ℹ️ *${LOTTERY_TYPES[type]}* 没有任何开奖记录。`);
    for (const r of records) {
        const text = `*类型*: ${LOTTERY_TYPES[type]}\n*期数*: \`${r.expect}\`\n*号码*: \`${r.openCode}\`\n*生肖*: ${r.zodiac || 'N/A'}\n*波色*: ${r.wave || 'N/A'}`;
        await bot.sendMessage(chat, text, { reply_markup: { inline_keyboard: [[{ text: '🗑️ 删除', callback_data: `delete:${r.id}` }]] }});
    }
}

async function handleDelete({ bot, db }, id, msgId) {
    await db.deleteRecord(id);
    await bot.editMessageText(chat, msgId, `✅ 记录(ID: ${id}) 已被删除。`);
}

// --- 辅助函数 ---
function sendLotterySelection(bot, chat, prefix, text) {
    const keyboard = Object.entries(LOTTERY_TYPES).map(([type, name]) => ({ text: name, callback_data: `${prefix}:${type}` }));
    const grid = []; for (let i = 0; i < keyboard.length; i += 2) grid.push(keyboard.slice(i, i + 2));
    grid.push([{ text: '❌ 关闭', callback_data: 'close:menu' }]);
    return bot.sendMessage(chat, text, { reply_markup: { inline_keyboard: grid } });
}

function getLotteryUrl(type, env) {
    try {
        const urls = JSON.parse(env.LOTTERY_URLS);
        return urls[type] ? urls[type].replace(/\b\d{4}\b/g, new Date().getFullYear()) : null;
    } catch (e) { console.error("Failed to parse LOTTERY_URLS env var:", e); return null; }
}

function formatPredictionText(p, typeName, createdAt = null) {
    const date = createdAt ? new Date(createdAt) : new Date(p.generatedAt);
    const localDate = date.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
    const title = createdAt ? `📜 ${typeName} 最新预测报告 📜` : `🔮 ${typeName} 全新预测报告 🔮`;

    return `
*${title}*
*生成时间*: \`${localDate}\`
----------------------------------------
*核心推荐 (综合加权)*
- *主攻生肖 (6肖)*: ${p.recommendations.combinedZodiacs.join(', ')}
- *大范围号码 (18码)*: \`${p.recommendations.combinedNumbers.join(', ')}\`

*数据洞察 (仅供参考)*
- *近期热点*: ${p.analysisDetails.hotZodiacs.join(', ')}
- *回归预警 (冷肖)*: ${p.analysisDetails.coldZodiacs.join(', ')}
- *遗漏冠军 (最久未出)*: ${p.analysisDetails.mostOverdueZodiacs.join(', ')}
- *跟随概率*: \`${p.analysisDetails.transitionFromLast}\`

*基于最近 ${p.basedOnRecords} 期有效数据生成*
    `;
}
