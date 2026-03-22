// functions/api/comics/create.js
export async function onRequestPost(context) {
    const { request, env } = context;

    const uploadToken = request.headers.get('X-Upload-Token');
    if (uploadToken !== env.ADMIN_UPLOAD_TOKEN) {
        return Response.json({ success: false, error: '无上传权限' }, { status: 403 });
    }

    try {
        const formData = await request.formData();
        const title = formData.get('title');
        const author = formData.get('author');
        const uploader = formData.get('uploader') || 'admin';
        const tags = JSON.stringify(formData.get('tags')?.split(',').map(t => t.trim()) || []);
        const chapters = parseInt(formData.get('chapters') || '1');
        const total_pages = parseInt(formData.get('total_pages') || '0');
        const description = formData.get('description') || '';
        const ownerRole = formData.get('owner_role') || 'user';
        const isAdult = formData.get('is_adult') === 'yes' ? 'yes' : 'no';
        const totalParts = parseInt(formData.get('total_parts') || '0');

        if (!title || !author) {
            return Response.json({ success: false, error: '标题和作者不能为空' }, { status: 400 });
        }

        const result = await env.DB.prepare(
            `INSERT INTO comics 
            (title, author, uploader, tags, chapters, pages, description, owner_role, is_adult, total_parts) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(title, author, uploader, tags, chapters, total_pages, description, ownerRole, isAdult, totalParts)
         .run();

        return Response.json({
            success: true,
            id: result.meta.last_row_id
        });

    } catch (err) {
        console.error('Create comic error:', err);
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}
