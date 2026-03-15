// functions/api/delete-user.js
export async function onRequestDelete(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const targetId = url.searchParams.get('id');
    if (!targetId) {
        return Response.json({ success: false, error: '缺少用户ID' }, { status: 400 });
    }

    const authRole = request.headers.get('X-Auth-Role');
    if (!authRole) {
        return Response.json({ success: false, error: '未提供身份信息' }, { status: 403 });
    }

    try {
        const targetUser = await env.DB.prepare(
            'SELECT role FROM users WHERE id = ?'
        ).bind(targetId).first();
        if (!targetUser) {
            return Response.json({ success: false, error: '用户不存在' }, { status: 404 });
        }

        if (authRole === 'system') {
            if (targetUser.role === 'system') {
                return Response.json({ success: false, error: '不能删除系统所有者' }, { status: 403 });
            }
        } else if (authRole === 'admin') {
            if (targetUser.role !== 'user') {
                return Response.json({ success: false, error: '无权删除此用户' }, { status: 403 });
            }
        } else {
            return Response.json({ success: false, error: '权限不足' }, { status: 403 });
        }

        await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(targetId).run();
        return Response.json({ success: true, message: '用户已删除' });
    } catch (err) {
        console.error('Delete user error:', err);
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}
