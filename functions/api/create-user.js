// functions/api/create-user.js
export async function onRequestPost(context) {
    const { request, env } = context;

    // 验证当前用户身份（从请求头获取）
    const authRole = request.headers.get('X-Auth-Role');
    const authUser = request.headers.get('X-Auth-Username');
    if (!authRole || !authUser) {
        return Response.json({ success: false, error: '未提供身份信息' }, { status: 403 });
    }

    // 只有 system 和 admin 可以访问此 API
    if (authRole !== 'system' && authRole !== 'admin') {
        return Response.json({ success: false, error: '权限不足' }, { status: 403 });
    }

    try {
        const { username, password, role = 'user', secondFactor } = await request.json();

        // 输入验证
        if (!username || !password) {
            return Response.json({ error: '用户名和密码不能为空' }, { status: 400 });
        }
        if (username.length < 3 || password.length < 6) {
            return Response.json({ error: '用户名至少3位，密码至少6位' }, { status: 400 });
        }
        // 第二因子如果提供，必须为8位
        if (secondFactor && secondFactor.length !== 8) {
            return Response.json({ error: '第二层验证码必须为8位' }, { status: 400 });
        }

        // 权限检查：admin 只能创建 user 角色
        if (authRole === 'admin' && role !== 'user') {
            return Response.json({ error: '管理员只能创建普通用户' }, { status: 403 });
        }
        // system 可以创建任何角色

        // 计算哈希
        const passwordHash = await sha256(password);
        const secondFactorHash = secondFactor ? await sha256(secondFactor) : null;

        // 插入数据库
        const stmt = env.DB.prepare(
            'INSERT INTO users (username, password_hash, second_factor_hash, role) VALUES (?, ?, ?, ?)'
        );
        await stmt.bind(username, passwordHash, secondFactorHash, role).run();

        return Response.json({ success: true, message: '用户创建成功' });

    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
            return Response.json({ error: '用户名已存在' }, { status: 409 });
        }
        console.error('Create user error:', err);
        return Response.json({ error: '服务器错误' }, { status: 500 });
    }
}

async function sha256(message) {
    const msgUint8 = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
