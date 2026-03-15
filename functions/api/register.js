// functions/api/register.js
export async function onRequestPost(context) {
    const { request, env } = context;

    // 验证当前用户是否有权限注册（需要管理员或 SYSTEM）
    // 我们通过请求头传递当前登录用户的用户名和角色（前端在 localStorage 存储）
    const authUsername = request.headers.get('X-Auth-Username');
    const authRole = request.headers.get('X-Auth-Role');

    // 验证当前用户身份
    if (!authUsername || !authRole) {
        return Response.json({ success: false, error: '未授权' }, { status: 403 });
    }

    // 只有 system 和 admin 可以注册
    if (authRole !== 'system' && authRole !== 'admin') {
        return Response.json({ success: false, error: '权限不足' }, { status: 403 });
    }

    try {
        const { username, password, secondFactor, role } = await request.json();

        // 验证输入
        if (!username || !password || !secondFactor) {
            return Response.json({ error: '缺少必要字段' }, { status: 400 });
        }
        if (username.length < 3 || password.length < 6) {
            return Response.json({ error: '用户名至少3位，密码至少6位' }, { status: 400 });
        }
        // 第二层密钥必须8位（可包含字母数字特殊符）
        if (secondFactor.length !== 8) {
            return Response.json({ error: '第二层验证码必须为8位' }, { status: 400 });
        }

        // 检查目标角色是否允许创建
        if (role === 'system' && authRole !== 'system') {
            return Response.json({ error: '只有 SYSTEM 可以创建 SYSTEM 用户' }, { status: 403 });
        }
        if (role === 'admin' && authRole !== 'system' && authRole !== 'admin') {
            return Response.json({ error: '权限不足' }, { status: 403 });
        }

        // 计算哈希
        const passwordHash = await sha256(password);
        const secondFactorHash = await sha256(secondFactor);

        // 插入数据库
        const stmt = env.DB.prepare(
            'INSERT INTO users (username, password_hash, second_factor_hash, role) VALUES (?, ?, ?, ?)'
        );
        await stmt.bind(username, passwordHash, secondFactorHash, role || 'user').run();

        return Response.json({ success: true });

    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
            return Response.json({ error: '用户名已存在' }, { status: 409 });
        }
        console.error('Register error:', err);
        return Response.json({ error: '服务器错误' }, { status: 500 });
    }
}

async function sha256(message) {
    const msgUint8 = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
