// functions/api/comics/upload.js
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
        const pages = parseInt(formData.get('pages') || '0');
        const description = formData.get('description') || '';
        const ownerRole = formData.get('owner_role') || 'user';
        const isAdult = formData.get('is_adult') === 'yes' ? 'yes' : 'no';

        if (!title || !author) {
            return Response.json({ success: false, error: '标题和作者不能为空' }, { status: 400 });
        }

        const coverFile = formData.get('cover');
        const zipFile = formData.get('zip');
        if (!coverFile || !zipFile) {
            return Response.json({ success: false, error: '请上传封面和ZIP文件' }, { status: 400 });
        }

        const MAX_SIZE = 5 * 1024 * 1024;
        if (coverFile.size > MAX_SIZE || zipFile.size > MAX_SIZE) {
            return Response.json({ success: false, error: '文件不能超过 5MB' }, { status: 400 });
        }

        const timestamp = Date.now();
        const coverFileName = `covers/${timestamp}_${coverFile.name}`;
        const zipFileName = `zips/${timestamp}_${zipFile.name}`;

        const coverArrayBuffer = await coverFile.arrayBuffer();
        const zipArrayBuffer = await zipFile.arrayBuffer();

        const coverBase64 = arrayBufferToBase64(coverArrayBuffer);
        const zipBase64 = arrayBufferToBase64(zipArrayBuffer);

        const headers = {
            'Authorization': `token ${env.GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': 'application/json',
            'User-Agent': 'Manga-Site-Uploader/1.0'
        };

        const branch = 'main';

        // 上传封面到 GitHub
        const coverRes = await fetch(`https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${coverFileName}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({
                message: `Add cover ${coverFileName}`,
                content: coverBase64,
                branch
            })
        });
        if (!coverRes.ok) {
            const errorText = await coverRes.text();
            throw new Error(`封面上传失败 (${coverRes.status}): ${errorText}`);
        }

        // 上传 ZIP 到 GitHub
        const zipRes = await fetch(`https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${zipFileName}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({
                message: `Add zip ${zipFileName}`,
                content: zipBase64,
                branch
            })
        });
        if (!zipRes.ok) {
            const errorText = await zipRes.text();
            throw new Error(`ZIP上传失败 (${zipRes.status}): ${errorText}`);
        }

        const rawBase = `https://raw.githubusercontent.com/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/${branch}`;
        const coverUrl = `${rawBase}/${coverFileName}`;
        const zipUrl = `${rawBase}/${zipFileName}`;

        // 写入 KV 缓存封面
        try {
            const coverKey = `file:${coverUrl}`;
            await env.FILE_CACHE.put(coverKey, coverArrayBuffer);
        } catch (kvErr) {
            console.error('封面写入 KV 失败:', kvErr);
        }

        // 插入数据库
        const result = await env.DB.prepare(
            `INSERT INTO comics 
            (title, author, uploader, tags, chapters, pages, cover_url, zip_url, description, owner_role, is_adult) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(title, author, uploader, tags, chapters, pages, coverUrl, zipUrl, description, ownerRole, isAdult)
         .run();

        return Response.json({
            success: true,
            id: result.meta.last_row_id,
            coverUrl,
            zipUrl
        });

    } catch (err) {
        console.error('Upload error:', err);
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}

function arrayBufferToBase64(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}
