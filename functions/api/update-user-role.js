// functions/api/update-user-role.js
export async function onRequestPatch(context) {
    const { request, env } = context;

    const authRole = request.headers.get('X-Auth-Role');
    if (!authRole) {
        return Response.json({ success: false, error: '未提供身份信息' }, { status: 403 });
    }

    if (authRole !== 'system') {
        return Response.json({ success: false, error: '权限不足' }, { status: 403 });
    }

    try {
        const { userId, newRole } = await request.json();
        if (!userId || !newRole) {
            return Response.json({ error: '缺少参数' }, { status: 400 });
        }
        if (newRole !== 'admin') {
            return Response.json({ error: '只能提升为管理员' }, { status: 400 });
        }

        const targetUser = await env.DB.prepare(
            'SELECT role FROM users WHERE id = ?'
        ).bind(userId).first();
        if (!targetUser) {
            return Response.json({ error: '用户不存在' }, { status: 404 });
        }
        if (targetUser.role === 'system') {
            return Response.json({ error: '不能修改系统所有者角色' }, { status: 403 });
        }
        if (targetUser.role === 'admin') {
            return Response.json({ error: '用户已经是管理员' }, { status: 400 });
        }

        await env.DB.prepare('UPDATE users SET role = ? WHERE id = ?').bind(newRole, userId).run();
        return Response.json({ success: true, message: '角色已更新' });
    } catch (err) {
        console.error('Update role error:', err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}
