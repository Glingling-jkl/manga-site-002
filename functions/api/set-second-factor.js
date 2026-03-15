// functions/api/set-second-factor.js (调试版)
export async function onRequestPost(context) {
    const { request } = context;

    // 打印请求头（可在 Cloudflare 日志中查看）
    console.log('Headers:', request.headers);

    // 直接返回成功，不操作数据库
    return new Response(JSON.stringify({ 
        success: true, 
        message: '调试模式：接口可访问',
        headers: Object.fromEntries(request.headers)
    }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
}
