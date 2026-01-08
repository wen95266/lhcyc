/**
 * 标准化 JSON 响应辅助函数
 */
const jsonResponse = (data, status = 200) => {
    return new Response(JSON.stringify({ status: 'success', data }), {
        headers: { 'Content-Type': 'application/json;charset=UTF-8' },
        status,
    });
};

/**
 * 标准化错误响应辅助函数
 */
const errorResponse = (message, status = 500) => {
    return new Response(JSON.stringify({ status: 'error', message }), {
        headers: { 'Content-Type': 'application/json;charset=UTF-8' },
        status,
    });
};

/**
 * 全局中间件
 */
export const onRequest = async (context) => {
    try {
        // 注入辅助方法
        context.json = (data, status) => jsonResponse(data, status);
        context.error = (message, status) => errorResponse(message, status);

        // 继续执行请求链
        const response = await context.next();

        // 核心修复：只在 API 路径下，且响应头中没有 Content-Type 时，才尝试设置或保持 JSON 格式
        // 对于静态资源（如 index.html, styles.css），让 Cloudflare Pages 自动处理它们的 Content-Type
        const url = new URL(context.request.url);
        if (url.pathname.startsWith('/api/')) {
            // 确保 API 响应是 JSON 格式
            const newResponse = new Response(response.body, response);
            newResponse.headers.set('Content-Type', 'application/json;charset=UTF-8');
            return newResponse;
        }

        return response;

    } catch (err) {
        console.error("Middleware Error:", err);
        return errorResponse('Internal Server Error: ' + err.message, 500);
    }
};
