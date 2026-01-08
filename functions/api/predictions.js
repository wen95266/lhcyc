import { LotteryDB } from '../db/d1-database.js';

/**
 * API 路由: /api/predictions
 * 
 * 这个路由负责从数据库中获取指定彩票类型的最新预测结果，并将其返回给前端。
 * 它需要一个查询参数 `?type=` 来指定彩票类型 (例如: /api/predictions?type=HK)。
 */
export const onRequestGet = async ({ request, env }) => {
    const { searchParams } = new URL(request.url);
    const lotteryType = searchParams.get('type');

    // 1. 验证输入参数
    if (!lotteryType) {
        return new Response(JSON.stringify({ error: 'Query parameter \'type\' is required.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        // 2. 初始化数据库并获取最新预测
        const db = new LotteryDB(env.DB);
        const latestPrediction = await db.getLatestPrediction(lotteryType);

        // 3. 处理未找到预测的情况
        if (!latestPrediction) {
            return new Response(JSON.stringify({ error: `No prediction found for type '${lotteryType}'.` }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // 4. 成功返回预测数据
        return new Response(JSON.stringify(latestPrediction.predictionData), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        // 5. 处理服务器内部错误
        console.error(`Failed to fetch prediction for ${lotteryType}:`, error);
        return new Response(JSON.stringify({ error: 'An internal server error occurred.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};
