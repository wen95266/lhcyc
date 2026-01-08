/**
 * 创建一个标准化的 JSON 响应。
 * @param {any} data - 要发送的数据。
 * @param {number} status - HTTP 状态码。
 * @returns {Response} - 标准化的 Response 对象。
 */
const jsonResponse = (data, status = 200) => {
    const body = JSON.stringify({ status: 'success', data });
    return new Response(body, {
        headers: { 'Content-Type': 'application/json;charset=UTF-8' },
        status,
    });
};

/**
 * 创建一个标准化的错误响应。
 * @param {string} message - 错误信息。
 * @param {number} status - HTTP 状态码。
 * @returns {Response} - 标准化的 Response 对象。
 */
const errorResponse = (message, status = 500) => {
    const body = JSON.stringify({ status: 'error', message });
    return new Response(body, {
        headers: { 'Content-Type': 'application/json;charset=UTF-8' },
        status,
    });
};

/**
 * 全局中间件，处理所有进入的请求。
 */
export const onRequest = async (context) => {
    try {
        // 将 jsonResponse 和 errorResponse 方法附加到上下文，方便后续处理函数使用
        context.json = (data, status) => jsonResponse(data, status);
        context.error = (message, status) => errorResponse(message, status);

        // 继续执行下一个处理函数
        const response = await context.next();

        // Cloudflare Pages 对响应头有特殊处理，这里确保响应头被正确应用
        response.headers.set('Content-Type', 'application/json;charset=UTF-8');
        return response;

    } catch (err) {
        // 如果在处理链中发生任何未捕获的错误，都在这里统一处理
        console.error("Unhandled error:", err);
        return errorResponse('Internal Server Error: ' + err.message, 500);
    }
};
