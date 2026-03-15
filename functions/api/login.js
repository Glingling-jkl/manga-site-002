// functions/api/login.js
export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        const { username, password, secondFactor } = await request.json();

        // 获取用户真实IP（Cloudflare 提供）
        const clientIP = request.headers.get('CF-Connecting-IP') || 
                         request.headers.get('X-Forwarded-For') || 
                         'unknown';

        // 查询用户
        const user = await env.DB.prepare(
            'SELECT id, username, password_hash, second_factor_hash, last_ip, role FROM users WHERE username = ?'
        ).bind(username).first();

        if (!user) {
            return Response.json({ success: false, error: '用户名或密码错误' }, { status: 401 });
        }

        // 验证密码
        const passwordHash = await sha256(password);
        if (passwordHash !== user.password_hash) {
            return Response.json({ success: false, error: '用户名或密码错误' }, { status: 401 });
        }

        // 检查IP是否匹配
        const ipMatch = (user.last_ip === clientIP);

        // 如果不匹配且需要第二因子，但未提供，则要求提供
        if (!ipMatch && !secondFactor) {
            return Response.json({ 
                success: false, 
                needSecondFactor: true,
                error: 'IP地址异常，请输入第二层验证码'
            }, { status: 401 });
        }

        // 如果IP不匹配，验证第二因子
        if (!ipMatch && secondFactor) {
            if (!user.second_factor_hash) {
                return Response.json({ success: false, error: '用户未设置第二层验证码' }, { status: 401 });
            }
            const secondFactorHash = await sha256(secondFactor);
            if (secondFactorHash !== user.second_factor_hash) {
                return Response.json({ success: false, error: '第二层验证码错误' }, { status: 401 });
            }
        }

        // 登录成功，更新 last_ip
        await env.DB.prepare(
            'UPDATE users SET last_ip = ? WHERE id = ?'
        ).bind(clientIP, user.id).run();

        // 设置登录状态（使用 localStorage 在前端记录）
        return Response.json({
            success: true,
            username: user.username,
            role: user.role
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
