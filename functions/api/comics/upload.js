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

        if (!title || !author) {
            return Response.json({ success: false, error: '标题和作者不能为空' }, { status: 400 });
        }

        const coverFile = formData.get('cover');
        const zipFile = formData.get('zip');
        if (!coverFile || !zipFile) {
            return Response.json({ success: false, error: '请上传封面和ZIP文件' }, { status: 400 });
        }

        // 检查文件大小（GitHub 限制 100MB）
        if (coverFile.size > 100 * 1024 * 1024 || zipFile.size > 100 * 1024 * 1024) {
            return Response.json({ success: false, error: '文件不能超过 100MB' }, { status: 400 });
        }

        // 生成唯一文件名
        const timestamp = Date.now();
        const coverFileName = `covers/${timestamp}_${coverFile.name}`;
        const zipFileName = `zips/${timestamp}_${zipFile.name}`;

        // 将文件转换为 base64
        const coverBase64 = await fileToBase64(coverFile);
        const zipBase64 = await fileToBase64(zipFile);

        // GitHub API 请求头（严格按照官方文档）
        const headers = {
            'Authorization': `token ${env.GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': 'application/json'
        };

        // 上传封面
        const coverUploadRes = await fetch(`https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${coverFileName}`, {
            method: 'PUT',
            headers: headers,
            body: JSON.stringify({
                message: `Add cover ${coverFileName}`,
                content: coverBase64,
                branch: 'main'  // 如果你的默认分支不是 main，请修改
            })
        });

        if (!coverUploadRes.ok) {
            const errorText = await coverUploadRes.text();
            let errorDetail;
            try {
                errorDetail = JSON.parse(errorText);
            } catch {
                errorDetail = { message: errorText };
            }
            throw new Error(`封面上传失败 (${coverUploadRes.status}): ${errorDetail.message || '未知错误'}`);
        }

        // 上传 ZIP
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
            const errorText = await zipUploadRes.text();
            let errorDetail;
            try {
                errorDetail = JSON.parse(errorText);
            } catch {
                errorDetail = { message: errorText };
            }
            throw new Error(`ZIP上传失败 (${zipUploadRes.status}): ${errorDetail.message || '未知错误'}`);
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
            error: err.message || '未知错误'
        }, { status: 500 });
    }
}

/**
 * 将 File 对象转换为 Base64 字符串（安全处理大文件）
 */
async function fileToBase64(file) {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}