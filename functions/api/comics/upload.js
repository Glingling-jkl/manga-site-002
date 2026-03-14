// functions/api/comics/upload.js
export async function onRequestPost(context) {
    const { request, env } = context;

    // 验证上传令牌
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
        const pages = parseInt(formData.get('pages') || '0');
        const description = formData.get('description') || '';

        // 上传封面到 HuggingFace
        const coverFile = formData.get('cover');
        let coverUrl = '';
        if (coverFile) {
            coverUrl = await uploadToHuggingFace(coverFile, env.HF_TOKEN, env.HF_SPACE);
        }

        // 上传ZIP到 HuggingFace
        const zipFile = formData.get('zip');
        let zipUrl = '';
        if (zipFile) {
            zipUrl = await uploadToHuggingFace(zipFile, env.HF_TOKEN, env.HF_SPACE);
        }

        // 存入数据库
        const result = await env.DB.prepare(
            `INSERT INTO comics 
            (title, author, uploader, tags, chapters, pages, cover_url, zip_url, description) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(title, author, uploader, tags, chapters, pages, coverUrl, zipUrl, description)
         .run();

        return Response.json({
            success: true,
            id: result.meta.last_row_id,
            coverUrl,
            zipUrl
        });

    } catch (err) {
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}

async function uploadToHuggingFace(file, token, spaceName) {
    const [user, repo] = spaceName.split('/');
    const url = `https://huggingface.co/api/repos/${user}/${repo}/upload`;

    const formData = new FormData();
    formData.append('file', file, file.name);

    const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(`HuggingFace上传失败: ${data.error || resp.statusText}`);

    return `https://huggingface.co/spaces/${spaceName}/raw/main/${file.name}`;
}