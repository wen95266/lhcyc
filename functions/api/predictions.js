import { LotteryDB } from '../db/d1-database.js';

// 定义允许的彩票类型常量，与 data.js 保持一致
const ALLOWED_TYPES = ['HK', 'XINAO', 'LAOAO', 'LAOAO_2230'];

/**
 * 处理获取最新预测数据的请求 (/api/predictions)
 */
export const onRequestGet = async (context) => {
    // 从上下文中解构所需的对象
    const { request, env, json, error } = context;

    const url = new URL(request.url);
    const lotteryType = url.searchParams.get('type');

    // 1. 输入验证：确保彩票类型已提供且在允许列表中
    if (!lotteryType) {
        return error('Query parameter \"type\" is required.', 400);
    }
    if (!ALLOWED_TYPES.includes(lotteryType)) {
        return error(`Invalid lottery type '${lotteryType}'. Allowed types are: ${ALLOWED_TYPES.join(', ')}`, 400);
    }

    try {
        // 2. 数据库操作：创建数据库实例并获取最新预测
        const db = new LotteryDB(env.DB);
        const latestPrediction = await db.getLatestPrediction(lotteryType);

        // 3. 处理未找到预测的情况
        if (!latestPrediction) {
            return error(`No prediction found for type '${lotteryType}'.`, 404);
        }

        // 4. 成功响应：使用标准化的 json 方法返回预测数据
        // 预测数据本身存储在 predictionData 属性中
        return json(latestPrediction.predictionData);

    } catch (e) {
        // 5. 错误处理：记录服务器端错误，并返回统一的错误信息
        console.error(`Failed to fetch prediction for ${lotteryType}:`, e);
        return error(`Database query failed: ${e.message}`, 500);
    }
};
