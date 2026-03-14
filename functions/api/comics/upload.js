// functions/api/comics/upload.js
import { createRepHub } from 'repohub';

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

        // 初始化 RepoHub
        const repoHub = createRepHub({
            ghToken: env.GITHUB_TOKEN,
            ghRepo: env.GITHUB_REPO,
            ghOwner: env.GITHUB_OWNER
        });

        // 生成唯一文件名（避免覆盖）
        const timestamp = Date.now();
        const coverFileName = `covers/${timestamp}_${coverFile.name}`;
        const zipFileName = `zips/${timestamp}_${zipFile.name}`;

        // 将文件转换为 base64
        const coverBytes = await coverFile.arrayBuffer();
        const coverBase64 = btoa(String.fromCharCode(...new Uint8Array(coverBytes)));

        const zipBytes = await zipFile.arrayBuffer();
        const zipBase64 = btoa(String.fromCharCode(...new Uint8Array(zipBytes)));

        // 上传封面
        const coverUpload = await repoHub.upload({
            mimeType: coverFile.name.split('.').pop() || 'jpg',
            content: coverBase64,
            path: 'covers'
        });

        // 上传 ZIP
        const zipUpload = await repoHub.upload({
            mimeType: 'zip',
            content: zipBase64,
            path: 'zips'
        });

        // 生成 jsDelivr CDN 加速链接 [citation:4][citation:8]
        const cdnBase = `https://cdn.jsdelivr.net/gh/${env.GITHUB_OWNER}/${env.GITHUB_REPO}@main`;
        const coverUrl = `${cdnBase}/${coverUpload.path}`;
        const zipUrl = `${cdnBase}/${zipUpload.path}`;

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