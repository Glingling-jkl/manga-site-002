// functions/api/register.js
// 使用 Web Crypto API 进行密码哈希（SHA-256），无需外部依赖

export async function onRequest(context) {
  const { request, env } = context;

  // 只允许 POST
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { username, password } = await request.json();

    // 验证输入
    if (!username || !password || username.length < 3 || password.length < 6) {
      return new Response(JSON.stringify({
        error: '用户名至少3位，密码至少6位'
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // 使用 SHA-256 哈希密码
    const passwordHash = await sha256(password);

    // 插入数据库
    const stmt = env.DB.prepare(
      'INSERT INTO users (username, password_hash) VALUES (?, ?)'
    );
    
    try {
      await stmt.bind(username, passwordHash).run();
    } catch (dbError) {
      // 处理唯一约束冲突（用户名已存在）
      if (dbError.message.includes('UNIQUE constraint failed')) {
        return new Response(JSON.stringify({
          error: '用户名已存在'
        }), { status: 409, headers: { 'Content-Type': 'application/json' } });
      }
      throw dbError;
    }

    return new Response(JSON.stringify({
      success: true,
      message: '注册成功'
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('注册错误:', err);
    return new Response(JSON.stringify({
      error: '服务器内部错误'
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

// 辅助函数：计算 SHA-256 哈希并返回十六进制字符串
async function sha256(message) {
  const msgUint8 = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}