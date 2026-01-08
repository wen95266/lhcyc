/**
 * API Endpoint: /api/data
 * 
 * 职责：提供标准化的历史开奖数据访问接口。
 * 
 * V2.0 更新：
 * - 完全集成到新的中间件系统 (`middleware.js`)。
 * - 不再需要手动创建数据库连接或处理响应格式。
 * - 核心逻辑简化为直接从 `context.db` 调用 `getRecords`。
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
        const records = await db.getRecords(lotteryType);
        return json(records);
    } catch (e) {
        console.error(`[API /data] Database query failed for type=${lotteryType}:`, e);
        return error('Failed to fetch records from the database.', 500);
    }
};

// 通过中间件包装，导出最终的请求处理器
export const onRequestGet = createHandler(handler);
