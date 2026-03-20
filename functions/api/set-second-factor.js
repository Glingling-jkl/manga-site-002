// functions/api/set-second-factor.js
export async function onRequestPost(context) {
    const { request, env } = context;

    // 从请求头获取用户名（登录时已临时存储）
    const authUsername = request.headers.get('X-Auth-Username');
    if (!authUsername) {
        return Response.json({ success: false, error: '未提供身份信息' }, { status: 403 });
    }

    try {
        const { secondFactor } = await request.json();
        if (!secondFactor || secondFactor.length !== 8) {
            return Response.json({ error: '第二层验证码必须为8位' }, { status: 400 });
        }

        const secondFactorHash = await sha256(secondFactor);

        const result = await env.DB.prepare(
            'UPDATE users SET second_factor_hash = ? WHERE username = ?'
        ).bind(secondFactorHash, authUsername).run();

        if (result.meta.changes === 0) {
            return Response.json({ error: '用户不存在' }, { status: 404 });
        }

        // 设置成功，返回成功并告知前端跳转到登录页（让用户手动登录）
        return Response.json({ 
            success: true, 
            message: '第二层验证码设置成功，请重新登录',
            redirect: '/login.html'  // 前端可根据此字段跳转
        });
    } catch (err) {
        console.error('Set second factor error:', err);
        return Response.json({ error: '服务器错误' }, { status: 500 });
    }
}

async function sha256(message) {
    const msgUint8 = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
