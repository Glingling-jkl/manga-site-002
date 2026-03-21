// functions/api/comments.js
export async function onRequestGet(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const comicId = url.searchParams.get('comicId');
    if (!comicId) {
        return Response.json({ success: false, error: '缺少漫画ID' }, { status: 400 });
    }

    try {
        const { results } = await env.DB.prepare(
            'SELECT id, username, content, created_at FROM comments WHERE comic_id = ? ORDER BY created_at DESC'
        ).bind(comicId).all();
        return Response.json({ success: true, data: results });
    } catch (err) {
        console.error('Get comments error:', err);
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}

export async function onRequestPost(context) {
    const { request, env } = context;

    // 验证用户登录（通过 localStorage 传递的 X-Auth-Username 和 X-Auth-Role）
    const username = request.headers.get('X-Auth-Username');
    const userId = request.headers.get('X-Auth-UserId');
    if (!username || !userId) {
        return Response.json({ success: false, error: '请先登录' }, { status: 401 });
    }

    try {
        const { comicId, content } = await request.json();
        if (!comicId || !content) {
            return Response.json({ success: false, error: '缺少参数' }, { status: 400 });
        }

        // 验证漫画是否存在（可选）
        const comic = await env.DB.prepare('SELECT id FROM comics WHERE id = ?').bind(comicId).first();
        if (!comic) {
            return Response.json({ success: false, error: '漫画不存在' }, { status: 404 });
        }

        const result = await env.DB.prepare(
            'INSERT INTO comments (comic_id, user_id, username, content) VALUES (?, ?, ?, ?)'
        ).bind(comicId, userId, username, content).run();

        return Response.json({ success: true, id: result.meta.last_row_id });
    } catch (err) {
        console.error('Post comment error:', err);
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}
