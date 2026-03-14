// functions/api/comics/upload.js
export async function onRequestPost(context) {
    const { request, env } = context;

    // 1. 令牌验证
    const token = request.headers.get('X-Upload-Token');
    if (token !== env.ADMIN_UPLOAD_TOKEN) {
        return Response.json({ success: false, error: '无上传权限' }, { status: 403 });
    }

    try {
        // 2. 解析表单数据
        const formData = await request.formData();
        const title = formData.get('title');
        const author = formData.get('author');
        const uploader = formData.get('uploader') || 'admin';
        const tagsRaw = formData.get('tags') || '';
        // 将逗号分隔的标签转换为JSON数组
        const tags = JSON.stringify(tagsRaw.split(',').map(t => t.trim()).filter(t => t));
        const chapters = parseInt(formData.get('chapters') || '1');
        const pages = parseInt(formData.get('pages') || '0');
        const description = formData.get('description') || '';
        const coverFile = formData.get('cover');
        const zipFile = formData.get('zip');

        // 检查必要字段
        if (!title || !author) {
            return Response.json({ success: false, error: '标题和作者为必填项' }, { status: 400 });
        }
        if (!coverFile || !zipFile) {
            return Response.json({ success: false, error: '封面和ZIP文件为必填项' }, { status: 400 });
        }

        // 3. 上传封面到 HuggingFace
        let coverUrl;
        try {
            coverUrl = await uploadToHuggingFace(coverFile, env.HF_TOKEN, env.HF_SPACE);
        } catch (e) {
            return Response.json({ success: false, error: '封面上传失败: ' + e.message }, { status: 500 });
        }

        // 4. 上传ZIP到 HuggingFace
        let zipUrl;
        try {
            zipUrl = await uploadToHuggingFace(zipFile, env.HF_TOKEN, env.HF_SPACE);
        } catch (e) {
            return Response.json({ success: false, error: 'ZIP上传失败: ' + e.message }, { status: 500 });
        }

        // 5. 插入数据库
        try {
            const result = await env.DB.prepare(
                `INSERT INTO comics 
                (title, author, uploader, tags, chapters, pages, description, cover_url, zip_url) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(
                title, author, uploader, tags, chapters, pages, description, coverUrl, zipUrl
            ).run();

            return Response.json({
                success: true,
                id: result.meta.last_row_id,
                coverUrl,
                zipUrl
            });
        } catch (dbErr) {
            return Response.json({ success: false, error: '数据库插入失败: ' + dbErr.message }, { status: 500 });
        }

    } catch (err) {
        return Response.json({ success: false, error: '服务器内部错误: ' + err.message }, { status: 500 });
    }
}

// 处理非POST请求
export async function onRequestGet() {
    return new Response('Method Not Allowed', { status: 405 });
}

// HuggingFace 上传函数
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
    if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
    return `https://huggingface.co/spaces/${spaceName}/raw/main/${file.name}`;
}