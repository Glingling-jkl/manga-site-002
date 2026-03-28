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
            `SELECT id, user_id, username, user_role, content, 
                    CAST(strftime('%s', created_at) AS INTEGER) * 1000 AS created_at_ms,
                    parent_id
             FROM comments WHERE comic_id = ? 
             ORDER BY created_at ASC`
        ).bind(comicId).all();
        const data = results.map(r => ({ ...r, created_at: r.created_at_ms }));
        return Response.json({ success: true, data });
    } catch (err) {
        console.error('Get comments error:', err);
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}

export async function onRequestPost(context) {
    const { request, env } = context;
    const userId = request.headers.get('X-Auth-UserId');
    if (!userId) {
        return Response.json({ success: false, error: '请先登录' }, { status: 401 });
    }

    try {
        const { comicId, content, parentId, replyToUserId } = await request.json();
        if (!comicId || !content) {
            return Response.json({ success: false, error: '缺少参数' }, { status: 400 });
        }

        const comic = await env.DB.prepare('SELECT id FROM comics WHERE id = ?').bind(comicId).first();
        if (!comic) {
            return Response.json({ success: false, error: '漫画不存在' }, { status: 404 });
        }

        const user = await env.DB.prepare('SELECT username, role FROM users WHERE id = ?').bind(userId).first();
        if (!user) {
            return Response.json({ success: false, error: '用户不存在' }, { status: 404 });
        }

        let parentIdValue = 0;
        let replyToUserIdValue = null;

        if (parentId && parentId > 0) {
            const parent = await env.DB.prepare(
                'SELECT id, user_id, username, parent_id FROM comments WHERE id = ? AND comic_id = ?'
            ).bind(parentId, comicId).first();
            if (!parent) {
                return Response.json({ success: false, error: '父评论不存在' }, { status: 404 });
            }
            if (parent.parent_id !== 0) {
                return Response.json({ success: false, error: '不能回复二级评论' }, { status: 400 });
            }
            parentIdValue = parentId;
            replyToUserIdValue = replyToUserId || parent.user_id;
        }

        const result = await env.DB.prepare(
            `INSERT INTO comments 
             (comic_id, user_id, username, user_role, content, parent_id, reply_to_user_id) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(comicId, userId, user.username, user.role, content, parentIdValue, replyToUserIdValue)
         .run();

        return Response.json({ success: true, id: result.meta.last_row_id });
    } catch (err) {
        console.error('Post comment error:', err);
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}

export async function onRequestDelete(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const commentId = url.searchParams.get('id');
    if (!commentId) {
        return Response.json({ success: false, error: '缺少评论ID' }, { status: 400 });
    }

    const userId = request.headers.get('X-Auth-UserId');
    const userRole = request.headers.get('X-Auth-Role');
    if (!userId) {
        return Response.json({ success: false, error: '未登录' }, { status: 401 });
    }

    try {
        const comment = await env.DB.prepare(
            `SELECT id, user_id, user_role, parent_id,
                    CAST(strftime('%s', created_at) AS INTEGER) * 1000 AS created_at_ms
             FROM comments WHERE id = ?`
        ).bind(commentId).first();
        if (!comment) {
            return Response.json({ success: false, error: '评论不存在' }, { status: 404 });
        }

        const now = Date.now();
        const isWithin5Min = (now - comment.created_at_ms) <= 5 * 60 * 1000;
        const isOwner = (comment.user_id == userId);

        let canDelete = false;
        if (userRole === 'system') {
            canDelete = true;
        } else if (userRole === 'admin') {
            if (comment.user_role === 'user') {
                canDelete = true;
            }
        } else if (userRole === 'user') {
            if (isOwner && isWithin5Min) {
                canDelete = true;
            }
        }

        if (!canDelete) {
            return Response.json({ success: false, error: '无权删除此评论' }, { status: 403 });
        }

        // 只有一级评论才删除其子评论
        if (comment.parent_id === 0) {
            await env.DB.prepare('DELETE FROM comments WHERE parent_id = ?').bind(commentId).run();
        }
        await env.DB.prepare('DELETE FROM comments WHERE id = ?').bind(commentId).run();

        return Response.json({ success: true, message: '删除成功' });
    } catch (err) {
        console.error('Delete comment error:', err);
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}
