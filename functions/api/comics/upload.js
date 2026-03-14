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

        const coverFile = formData.get('cover');
        const zipFile = formData.get('zip');
        if (!coverFile || !zipFile) {
            return Response.json({ success: false, error: '请上传封面和ZIP文件' }, { status: 400 });
        }

        // 生成唯一文件名（避免覆盖）
        const timestamp = Date.now();
        const coverFileName = `covers/${timestamp}_${coverFile.name}`;
        const zipFileName = `zips/${timestamp}_${zipFile.name}`;

        // 将文件转换为 base64
        const coverBytes = await coverFile.arrayBuffer();
        const coverBase64 = btoa(String.fromCharCode(...new Uint8Array(coverBytes)));

        const zipBytes = await zipFile.arrayBuffer();
        const zipBase64 = btoa(String.fromCharCode(...new Uint8Array(zipBytes)));

        // 准备 GitHub API 请求头
        const headers = {
            'Authorization': `token ${env.GITHUB_TOKEN}`,
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.github.v3+json'
        };

        // 上传封面到 GitHub
        const coverUploadRes = await fetch(`https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${coverFileName}`, {
            method: 'PUT',
            headers: headers,
            body: JSON.stringify({
                message: `Add cover ${coverFileName}`,
                content: coverBase64,
                branch: 'main'
            })
        });

        if (!coverUploadRes.ok) {
            const error = await coverUploadRes.text();
            throw new Error(`封面上传失败: ${coverUploadRes.status} ${error}`);
        }

        // 上传 ZIP 到 GitHub
        const zipUploadRes = await fetch(`https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${zipFileName}`, {
            method: 'PUT',
            headers: headers,
            body: JSON.stringify({
                message: `Add zip ${zipFileName}`,
                content: zipBase64,
                branch: 'main'
            })
        });

        if (!zipUploadRes.ok) {
            const error = await zipUploadRes.text();
            throw new Error(`ZIP上传失败: ${zipUploadRes.status} ${error}`);
        }

        // 生成 jsDelivr CDN 加速链接
        const cdnBase = `https://cdn.jsdelivr.net/gh/${env.GITHUB_OWNER}/${env.GITHUB_REPO}@main`;
        const coverUrl = `${cdnBase}/${coverFileName}`;
        const zipUrl = `${cdnBase}/${zipFileName}`;

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
        console.error('Upload error:', err);
        return Response.json({ 
            success: false, 
            error: `上传失败: ${err.message}`
        }, { status: 500 });
    }
}