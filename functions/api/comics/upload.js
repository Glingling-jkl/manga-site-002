// functions/api/comics/upload.js
import { Octokit } from "@octokit/core";

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

        // 初始化 Octokit
        const octokit = new Octokit({ auth: env.GITHUB_TOKEN });

        // 生成唯一文件名（避免覆盖）
        const timestamp = Date.now();
        const coverFileName = `covers/${timestamp}_${coverFile.name}`;
        const zipFileName = `zips/${timestamp}_${zipFile.name}`;

        // 将文件转换为 base64
        const coverBytes = await coverFile.arrayBuffer();
        const coverBase64 = btoa(String.fromCharCode(...new Uint8Array(coverBytes)));

        const zipBytes = await zipFile.arrayBuffer();
        const zipBase64 = btoa(String.fromCharCode(...new Uint8Array(zipBytes)));

        // 上传封面到 GitHub
        const coverUpload = await octokit.request('PUT /repos/{owner}/{repo}/contents/{path}', {
            owner: env.GITHUB_OWNER,
            repo: env.GITHUB_REPO,
            path: coverFileName,
            message: `Add cover ${coverFileName}`,
            content: coverBase64,
            branch: 'main'
        });

        // 上传 ZIP 到 GitHub
        const zipUpload = await octokit.request('PUT /repos/{owner}/{repo}/contents/{path}', {
            owner: env.GITHUB_OWNER,
            repo: env.GITHUB_REPO,
            path: zipFileName,
            message: `Add zip ${zipFileName}`,
            content: zipBase64,
            branch: 'main'
        });

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