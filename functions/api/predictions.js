/**
 * API Endpoint: /api/predictions
 * 
 * 职责：提供标准化的最新预测报告访问接口。
 * 
 * V2.0 更新：
 * - 完全集成到新的中间件系统 (`middleware.js`)。
 * - 核心逻辑简化为直接从 `context.db` 调用 `getLatestPrediction`。
 * - 增加了对未找到预测的 404 Not Found 响应。
 */
import { createHandler } from '../logic/middleware.js';

const handler = async (context) => {
    const { request, db, json, error } = context;
    
    const url = new URL(request.url);
    const lotteryType = url.searchParams.get('type');

    if (!lotteryType) {
        return error('Query parameter `type` is required.', 400);
    }

    try {
        const latest = await db.getLatestPrediction(lotteryType);

        if (!latest || !latest.predictionData) {
            return error(`No prediction found for type '${lotteryType}'. Please generate one first.`, 404);
        }

        return json(latest.predictionData);

    } catch (e) {
        console.error(`[API /predictions] Database query failed for type=${lotteryType}:`, e);
        return error('Failed to fetch prediction from the database.', 500);
    }
};

// 通过中间件包装，导出最终的请求处理器
export const onRequestGet = createHandler(handler);
