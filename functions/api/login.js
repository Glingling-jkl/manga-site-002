export async function onRequest(context) {
    const { request, env } = context;

    if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    try {
        const { username, password } = await request.json();

        // 测试数据库连接
        try {
            const test = await env.DB.prepare("SELECT 1").first();
            console.log("DB connection test:", test);
        } catch (dbConnErr) {
            return new Response(JSON.stringify({ 
                error: "DB connection failed", 
                details: dbConnErr.message 
            }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }

        // 查询用户
        const stmt = env.DB.prepare(
            'SELECT id, username, password_hash FROM users WHERE username = ?'
        );
        const user = await stmt.bind(username).first();

        if (!user) {
            return new Response(JSON.stringify({ error: '用户名或密码错误' }), { 
                status: 401, headers: { 'Content-Type': 'application/json' } 
            });
        }

        // 计算哈希
        const inputHash = await sha256(password);
        if (inputHash !== user.password_hash) {
            return new Response(JSON.stringify({ error: '用户名或密码错误' }), { 
                status: 401, headers: { 'Content-Type': 'application/json' } 
            });
        }

        return new Response(JSON.stringify({ success: true, username: user.username }), { 
            status: 200, headers: { 'Content-Type': 'application/json' } 
        });

    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { 
            status: 500, headers: { 'Content-Type': 'application/json' } 
        });
    }
}

async function sha256(message) {
    const msgUint8 = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}