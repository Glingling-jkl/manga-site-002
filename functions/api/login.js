// functions/api/login.js
export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        const { username, password, secondFactor } = await request.json();

        const clientIP = request.headers.get('CF-Connecting-IP') || 
                         request.headers.get('X-Forwarded-For') || 
                         '0.0.0.0';

        const user = await env.DB.prepare(
            'SELECT id, username, password_hash, second_factor_hash, last_ip, role FROM users WHERE username = ?'
        ).bind(username).first();

        if (!user) {
            return Response.json({ success: false, error: '用户名或密码错误' }, { status: 401 });
        }

        const passwordHash = await sha256(password);
        if (passwordHash !== user.password_hash) {
            return Response.json({ success: false, error: '用户名或密码错误' }, { status: 401 });
        }

        // 检查是否已设置第二因子
        if (!user.second_factor_hash) {
            return Response.json({
                success: false,
                needSetSecondFactor: true,
                username: user.username,
                userId: user.id   // 返回 userId，前端存储
            }, { status: 401 });
        }

        const ipMatch = (user.last_ip === clientIP);

        if (!ipMatch && !secondFactor) {
            return Response.json({ 
                success: false, 
                needSecondFactor: true,
                error: 'IP地址异常，请输入第二层验证码'
            }, { status: 401 });
        }

        if (!ipMatch && secondFactor) {
            const secondFactorHash = await sha256(secondFactor);
            if (secondFactorHash !== user.second_factor_hash) {
                return Response.json({ success: false, error: '第二层验证码错误' }, { status: 401 });
            }
        }

        await env.DB.prepare(
            'UPDATE users SET last_ip = ? WHERE id = ?'
        ).bind(clientIP, user.id).run();

        // 登录成功，返回用户信息
        return Response.json({
            success: true,
            username: user.username,
            role: user.role,
            userId: user.id
        });

    } catch (err) {
        console.error('Login error:', err);
        return Response.json({ success: false, error: '服务器错误' }, { status: 500 });
    }
}

async function sha256(message) {
    const msgUint8 = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
