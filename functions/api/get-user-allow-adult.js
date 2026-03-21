// functions/api/get-user-allow-adult.js
export async function onRequestGet(context) {
    const { request, env } = context;
    const userId = request.headers.get('X-Auth-UserId');
    if (!userId) {
        return Response.json({ success: false, error: '未登录' }, { status: 401 });
    }

    try {
        const user = await env.DB.prepare('SELECT allow_adult FROM users WHERE id = ?').bind(userId).first();
        if (!user) {
            return Response.json({ error: '用户不存在' }, { status: 404 });
        }
        return Response.json({ success: true, allow_adult: user.allow_adult });
    } catch (err) {
        return Response.json({ error: '服务器错误' }, { status: 500 });
    }
}
