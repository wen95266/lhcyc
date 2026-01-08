import { LotteryDB } from '../db/d1-database.js';

// 定义允许的彩票类型常量，方便管理和校验
const ALLOWED_TYPES = ['HK', 'XINAO', 'LAOAO', 'LAOAO_2230'];

/**
 * 处理获取开奖数据请求 (/api/data)
 */
export const onRequestGet = async (context) => {
    // 从上下文中解构所需的对象，包括在中间件中添加的 json 和 error 方法
    const { request, env, json, error } = context;

    const url = new URL(request.url);
    const lotteryType = url.searchParams.get('type');

    // 1. 输入验证：确保彩票类型已提供且在允许列表中
    if (!lotteryType) {
        return error('Lottery type must be provided via query parameter ?type=TYPE', 400);
    }
    if (!ALLOWED_TYPES.includes(lotteryType)) {
        return error(`Invalid lottery type '${lotteryType}'. Allowed types are: ${ALLOWED_TYPES.join(', ')}`, 400);
    }

    try {
        // 2. 数据库操作：创建数据库实例并获取记录
        const db = new LotteryDB(env.DB);
        const records = await db.getRecords(lotteryType);
        
        // 3. 成功响应：使用标准化的 json 方法返回数据
        return json(records);

    } catch (e) {
        // 4. 错误处理：记录服务器端错误，并使用标准化的 error 方法返回错误信息
        console.error(`Failed to fetch records for lottery type ${lotteryType}:`, e);
        return error(`Database query failed: ${e.message}`, 500);
    }
};
