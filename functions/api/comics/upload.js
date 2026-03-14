export async function onRequestPost(context) {
    // 处理 POST 请求
    return Response.json({ success: true, message: 'upload works' });
}

// 可选：处理其他方法，避免被路由到其他地方
export async function onRequestGet(context) {
    return new Response('Method Not Allowed', { status: 405 });
}