// functions/api/comics/upload-part.js
export async function onRequestPost(context) {
    const { request, env } = context;

    const uploadToken = request.headers.get('X-Upload-Token');
    if (uploadToken !== env.ADMIN_UPLOAD_TOKEN) {
        return Response.json({ success: false, error: '无上传权限' }, { status: 403 });
    }

    try {
        const formData = await request.formData();
        const comicId = formData.get('comicId');
        const partIndex = parseInt(formData.get('partIndex'));
        const zipFile = formData.get('zipFile');
        const originalName = formData.get('originalName') || `part_${partIndex + 1}.zip`;

        const comic = await env.DB.prepare(
            'SELECT title, uploaded_at FROM comics WHERE id = ?'
        ).bind(comicId).first();
        if (!comic) {
            return Response.json({ success: false, error: '漫画不存在' }, { status: 404 });
        }

        const timestamp = new Date(comic.uploaded_at).getTime() || Date.now();
        const safeTitle = comic.title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
        const folderName = `zip-s/${timestamp}_${safeTitle}`;
        const fileName = `${folderName}/zips/${originalName}`;

        const arrayBuffer = await zipFile.arrayBuffer();
        const base64 = arrayBufferToBase64(arrayBuffer);

        const headers = {
            'Authorization': `token ${env.GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': 'application/json',
            'User-Agent': 'Manga-Site-Uploader/1.0'
        };
        const branch = 'main';

        const res = await fetch(`https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${fileName}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({
                message: `Add part ${partIndex + 1} for comic ${comicId}`,
                content: base64,
                branch
            })
        });

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`GitHub 上传失败: ${res.status} ${errorText}`);
        }

        // 写入 KV 缓存
        try {
            const rawUrl = `https://raw.githubusercontent.com/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/${branch}/${fileName}`;
            const kvKey = `file:${rawUrl}`;
            await env.FILE_CACHE.put(kvKey, arrayBuffer, { expirationTtl: 2592000 });
        } catch (kvErr) {
            console.error('KV 写入失败（不影响上传）:', kvErr);
        }

        return Response.json({ success: true });
    } catch (err) {
        console.error('Upload part error:', err);
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
