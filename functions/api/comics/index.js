// functions/api/comics/index.js
export async function onRequestGet(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const userId = request.headers.get('X-Auth-UserId');
    const search = url.searchParams.get('search') || '';
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    let allowAdult = true; // 默认允许
    if (userId) {
        const user = await env.DB.prepare('SELECT allow_adult FROM users WHERE id = ?').bind(userId).first();
        if (user && user.allow_adult === 'no') {
            allowAdult = false;
        }
    }

    let query = 'SELECT * FROM comics';
    let countQuery = 'SELECT COUNT(*) as total FROM comics';
    let params = [];

    if (search) {
        query += ' WHERE title LIKE ? OR author LIKE ?';
        countQuery += ' WHERE title LIKE ? OR author LIKE ?';
        const searchPattern = `%${search}%`;
        params = [searchPattern, searchPattern];
    }

    // 如果用户不允许成人内容，添加过滤条件
    if (!allowAdult) {
        const adultFilter = ' is_adult = ? ';
        if (params.length) {
            query += ' AND ' + adultFilter;
            countQuery += ' AND ' + adultFilter;
        } else {
            query += ' WHERE ' + adultFilter;
            countQuery += ' WHERE ' + adultFilter;
        }
        params.push('no');
    }

    query += ' ORDER BY uploaded_at DESC LIMIT ? OFFSET ?';
    const totalResult = await env.DB.prepare(countQuery).bind(...params).first();
    const { results } = await env.DB.prepare(query).bind(...params, limit, offset).all();

    const comics = results.map(c => ({
        ...c,
        tags: JSON.parse(c.tags || '[]')
    }));

    return Response.json({
        success: true,
        data: comics,
        pagination: {
            page,
            limit,
            total: totalResult.total,
            pages: Math.ceil(totalResult.total / limit)
        }
    });
}
