// functions/api/get-users.js
export async function onRequestGet(context) {
    const { request, env } = context;

    const authRole = request.headers.get('X-Auth-Role');
    if (!authRole) {
        return Response.json({ success: false, error: '未提供身份信息' }, { status: 403 });
    }

    try {
        if (authRole === 'system') {
            const { results } = await env.DB.prepare(
                'SELECT id, username, role, adult_enabled, allow_adult, created_at FROM users WHERE role != ? ORDER BY created_at DESC'
            ).bind('system').all();
            return Response.json({ success: true, data: results });
        } else if (authRole === 'admin') {
            const { results } = await env.DB.prepare(
                'SELECT id, username, role, adult_enabled, allow_adult, created_at FROM users WHERE role = ? ORDER BY created_at DESC'
            ).bind('user').all();
            return Response.json({ success: true, data: results });
        } else {
            return Response.json({ success: false, error: '权限不足' }, { status: 403 });
        }
    } catch (err) {
        console.error('Get users error:', err);
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}
