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
        const coverFile = formData.get('cover'); // 新增封面文件

        if (!title || !author) {
            return Response.json({ success: false, error: '标题和作者不能为空' }, { status: 400 });
        }
        if (!coverFile) {
            return Response.json({ success: false, error: '请上传封面图片' }, { status: 400 });
        }

        // 限制封面大小 (5MB)
        const MAX_SIZE = 5 * 1024 * 1024;
        if (coverFile.size > MAX_SIZE) {
            return Response.json({ success: false, error: '封面不能超过 5MB' }, { status: 400 });
        }

        // 上传封面到 GitHub
        const timestamp = Date.now();
        const coverFileName = `covers/${timestamp}_${coverFile.name}`;
        const coverArrayBuffer = await coverFile.arrayBuffer();
        const coverBase64 = arrayBufferToBase64(coverArrayBuffer);

        const headers = {
            'Authorization': `token ${env.GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': 'application/json',
            'User-Agent': 'Manga-Site-Uploader/1.0'
        };
        const branch = 'main';

        const coverRes = await fetch(`https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${coverFileName}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({
                message: `Add cover for comic ${title}`,
                content: coverBase64,
                branch
            })
        });
        if (!coverRes.ok) {
            const errorText = await coverRes.text();
            throw new Error(`封面上传失败 (${coverRes.status}): ${errorText}`);
        }

        const rawBase = `https://raw.githubusercontent.com/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/${branch}`;
        const coverUrl = `${rawBase}/${coverFileName}`;

        // 写入 KV 缓存封面（永久保存，无 TTL）
        try {
            const coverKey = `file:${coverUrl}`;
            await env.FILE_CACHE.put(coverKey, coverArrayBuffer);
            console.log(`封面已写入 KV: ${coverUrl}`);
        } catch (kvErr) {
            console.error('封面写入 KV 失败:', kvErr);
        }

        // 插入数据库，包含封面 URL
        const result = await env.DB.prepare(
            `INSERT INTO comics 
            (title, author, uploader, tags, chapters, pages, cover_url, description, owner_role, is_adult, total_parts) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(title, author, uploader, tags, chapters, total_pages, coverUrl, description, ownerRole, isAdult, totalParts)
         .run();

        return Response.json({
            success: true,
            id: result.meta.last_row_id,
            coverUrl
        });
    } catch (err) {
        console.error('Create comic error:', err);
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
