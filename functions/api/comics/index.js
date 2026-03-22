// functions/api/comics/index.js
export async function onRequestGet(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const userId = request.headers.get('X-Auth-UserId');
    const userRole = request.headers.get('X-Auth-Role');
    const search = url.searchParams.get('search') || '';
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    let showAdult = true; // 默认允许
    // 如果用户未登录或不是管理员，则根据权限过滤
    if (userId && userRole !== 'system' && userRole !== 'admin') {
        const user = await env.DB.prepare(
            'SELECT adult_enabled, allow_adult FROM users WHERE id = ?'
        ).bind(userId).first();
        if (user && user.adult_enabled === 'yes' && user.allow_adult === 'yes') {
            showAdult = true;
        } else {
            showAdult = false;
        }
    } else if (!userId) {
        // 未登录用户只能看到非成人内容
        showAdult = false;
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

    // 如果用户不能看成人内容，添加过滤条件
    if (!showAdult) {
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
