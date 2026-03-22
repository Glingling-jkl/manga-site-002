// functions/api/update-user-adult-enabled.js
export async function onRequestPatch(context) {
    const { request, env } = context;

    const authRole = request.headers.get('X-Auth-Role');
    if (authRole !== 'system') {
        return Response.json({ success: false, error: '权限不足' }, { status: 403 });
    }

    const currentUserId = request.headers.get('X-Auth-UserId');
    try {
        const { userId, adultEnabled } = await request.json();
        if (!userId || !['yes', 'no'].includes(adultEnabled)) {
            return Response.json({ error: '参数错误' }, { status: 400 });
        }
        // 不能修改自己的权限
        if (currentUserId == userId) {
            return Response.json({ error: '不能修改自己的权限' }, { status: 403 });
        }
        await env.DB.prepare('UPDATE users SET adult_enabled = ? WHERE id = ?').bind(adultEnabled, userId).run();
        // 如果关闭权限，同时将 allow_adult 设为 no
        if (adultEnabled === 'no') {
            await env.DB.prepare('UPDATE users SET allow_adult = ? WHERE id = ?').bind('no', userId).run();
        }
        return Response.json({ success: true, message: '更新成功' });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}
