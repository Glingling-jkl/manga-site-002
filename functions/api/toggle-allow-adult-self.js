// functions/api/toggle-allow-adult-self.js
export async function onRequestPatch(context) {
    const { request, env } = context;
    const userId = request.headers.get('X-Auth-UserId');
    if (!userId) {
        return Response.json({ success: false, error: '未登录' }, { status: 401 });
    }

    try {
        const user = await env.DB.prepare(
            'SELECT adult_enabled, allow_adult FROM users WHERE id = ?'
        ).bind(userId).first();
        if (!user) {
            return Response.json({ error: '用户不存在' }, { status: 404 });
        }

        // 只有 adult_enabled 为 yes 时才能切换 allow_adult
        if (user.adult_enabled !== 'yes') {
            return Response.json({ error: '您未被授权查看高危内容' }, { status: 403 });
        }

        const newStatus = user.allow_adult === 'yes' ? 'no' : 'yes';
        await env.DB.prepare('UPDATE users SET allow_adult = ? WHERE id = ?').bind(newStatus, userId).run();

        return Response.json({ success: true, newStatus });
    } catch (err) {
        console.error('Toggle allow adult error:', err);
        return Response.json({ error: '服务器错误' }, { status: 500 });
    }
}
