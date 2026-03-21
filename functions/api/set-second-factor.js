// functions/api/set-second-factor.js
export async function onRequestPost(context) {
    const { request, env } = context;

    const userId = request.headers.get('X-Auth-UserId');
    if (!userId) {
        return Response.json({ success: false, error: '未提供身份信息，请重新登录' }, { status: 403 });
    }

    try {
        const { secondFactor } = await request.json();
        if (!secondFactor || secondFactor.length !== 8) {
            return Response.json({ error: '第二层验证码必须为8位' }, { status: 400 });
        }

        const secondFactorHash = await sha256(secondFactor);

        const result = await env.DB.prepare(
            'UPDATE users SET second_factor_hash = ? WHERE id = ?'
        ).bind(secondFactorHash, userId).run();

        if (result.meta.changes === 0) {
            return Response.json({ error: '用户不存在，请重新登录' }, { status: 404 });
        }

        return Response.json({ success: true, message: '第二层验证码设置成功' });
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
