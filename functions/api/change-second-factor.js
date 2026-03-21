// functions/api/change-second-factor.js
export async function onRequestPost(context) {
    const { request, env } = context;
    const userId = request.headers.get('X-Auth-UserId');
    if (!userId) {
        return Response.json({ success: false, error: '未登录' }, { status: 401 });
    }

    try {
        const { newSecondFactor } = await request.json();
        if (!newSecondFactor || newSecondFactor.length !== 8) {
            return Response.json({ error: '第二层验证码必须为8位' }, { status: 400 });
        }

        const hash = await sha256(newSecondFactor);
        await env.DB.prepare('UPDATE users SET second_factor_hash = ? WHERE id = ?').bind(hash, userId).run();

        return Response.json({ success: true, message: '第二层验证码已修改' });
    } catch (err) {
        console.error('Change second factor error:', err);
        return Response.json({ error: '服务器错误' }, { status: 500 });
    }
}

async function sha256(message) {
    const msgUint8 = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
