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

        // 检查必要字段
        if (!title || !author) {
            return Response.json({ success: false, error: '标题和作者不能为空' }, { status: 400 });
        }

        // 获取封面和ZIP文件
        const coverFile = formData.get('cover');
        const zipFile = formData.get('zip');
        if (!coverFile || !zipFile) {
            return Response.json({ success: false, error: '请上传封面和ZIP文件' }, { status: 400 });
        }

        // 上传封面到 HuggingFace
        let coverUrl = '';
        try {
            coverUrl = await uploadToHuggingFace(coverFile, env.HF_TOKEN, env.HF_SPACE);
        } catch (err) {
            return Response.json({ success: false, error: `封面上传失败: ${err.message}` }, { status: 500 });
        }

        // 上传ZIP到 HuggingFace
        let zipUrl = '';
        try {
            zipUrl = await uploadToHuggingFace(zipFile, env.HF_TOKEN, env.HF_SPACE);
        } catch (err) {
            return Response.json({ success: false, error: `ZIP上传失败: ${err.message}` }, { status: 500 });
        }

        // 存入数据库
        try {
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
        } catch (dbErr) {
            return Response.json({ success: false, error: `数据库错误: ${dbErr.message}` }, { status: 500 });
        }

    } catch (err) {
        // 捕获其他未知错误
        return Response.json({ 
            success: false, 
            error: `服务器内部错误: ${err.message}`,
            stack: err.stack  // 可选，帮助调试
        }, { status: 500 });
    }
}

/**
 * 上传文件到 HuggingFace Space
 * @param {File} file 要上传的文件
 * @param {string} token HuggingFace 访问令牌（Write权限）
 * @param {string} spaceName Space名称，格式 "用户名/空间名"
 * @returns {Promise<string>} 上传后文件的公开访问URL
 */
async function uploadToHuggingFace(file, token, spaceName) {
    if (!token) {
        throw new Error('HF_TOKEN 环境变量未设置');
    }
    if (!spaceName) {
        throw new Error('HF_SPACE 环境变量未设置');
    }

    const [user, repo] = spaceName.split('/');
    const url = `https://huggingface.co/api/repos/${user}/${repo}/upload`;

    const formData = new FormData();
    formData.append('file', file, file.name);

    const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
    });

    if (!resp.ok) {
        let errorText = '';
        try {
            errorText = await resp.text();
        } catch (e) {
            errorText = '无法读取错误详情';
        }
        throw new Error(`HTTP ${resp.status} ${resp.statusText}: ${errorText}`);
    }

    const data = await resp.json();
    // 返回公开访问URL（根据HuggingFace Space的文件路径）
    return `https://huggingface.co/spaces/${spaceName}/raw/main/${file.name}`;
}