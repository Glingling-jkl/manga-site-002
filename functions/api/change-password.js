// functions/api/change-password.js
export async function onRequestPost(context) {
    const { request, env } = context;
    const userId = request.headers.get('X-Auth-UserId');
    if (!userId) {
        return Response.json({ success: false, error: '未登录' }, { status: 401 });
    }

    try {
        const { oldPassword, newPassword } = await request.json();
        if (!oldPassword || !newPassword || newPassword.length < 6) {
            return Response.json({ error: '密码无效' }, { status: 400 });
        }

        const user = await env.DB.prepare('SELECT password_hash FROM users WHERE id = ?').bind(userId).first();
        if (!user) {
            return Response.json({ error: '用户不存在' }, { status: 404 });
        }

        const oldHash = await sha256(oldPassword);
        if (oldHash !== user.password_hash) {
            return Response.json({ error: '原密码错误' }, { status: 401 });
        }

        const newHash = await sha256(newPassword);
        await env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(newHash, userId).run();

        return Response.json({ success: true, message: '密码已修改' });
    } catch (err) {
        console.error('Change password error:', err);
        return Response.json({ error: '服务器错误' }, { status: 500 });
    }
}

async function sha256(message) {
    const msgUint8 = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
