/**
 * API Middleware V1.0
 * 
 * 职责：为所有 API 端点提供一个标准化的请求处理流程。
 * 功能：
 * 1. 自动注入数据库连接实例 (LotteryDB)。
 * 2. 提供标准化的 JSON 成功响应 (`json`) 和错误响应 (`error`) 方法。
 * 3. 捕获所有未处理的异常，防止服务器崩溃。
 */
import { LotteryDB } from '../db/d1-database.js';

/**
 * 创建一个标准化的 JSON 响应。
 * @param {*} data - 要发送的数据。
 * @param {number} [status=200] - HTTP 状态码。
 * @returns {Response}
 */
const jsonResponse = (data, status = 200) => {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' },
    });
};

/**
 * 创建一个标准化的错误响应。
 * @param {string} message - 错误信息。
 * @param {number} [status=500] - HTTP 状态码。
 * @returns {Response}
 */
const errorResponse = (message, status = 500) => {
    return jsonResponse({ error: message }, status);
};

/**
 * 中间件包装器，用于所有 API 路由。
 * 它会增强请求上下文，然后调用实际的业务逻辑处理函数。
 * @param {Function} handler - 接收增强上下文并处理请求的函数。
 * @returns {Function} - 一个符合 Cloudflare Pages `onRequest` 规范的函数。
 */
export const createHandler = (handler) => {
    return async (context) => {
        const { env } = context;

        try {
            // 使用数据库连接和响应助手来增强上下文
            const augmentedContext = {
                ...context,
                db: new LotteryDB(env.DB),
                json: jsonResponse,
                error: errorResponse,
            };
            
            // 使用增强后的上下文调用实际的处理程序
            return await handler(augmentedContext);

        } catch (e) {
            // 捕获所有未处理的异常，记录日志并返回一个通用的服务器错误
            console.error("[Middleware Error] Unhandled exception in API handler:", e);
            return errorResponse('An unexpected server error occurred. Please check logs.', 500);
        }
    };
};
