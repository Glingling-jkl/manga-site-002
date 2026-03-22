// functions/api/comics/finish-upload.js
export async function onRequestPost(context) {
    const { request, env } = context;

    const uploadToken = request.headers.get('X-Upload-Token');
    if (uploadToken !== env.ADMIN_UPLOAD_TOKEN) {
        return Response.json({ success: false, error: '无上传权限' }, { status: 403 });
    }

    try {
        const { comicId, total_pages, total_parts } = await request.json();

        const comic = await env.DB.prepare(
            'SELECT title, author, chapters, pages, uploaded_at FROM comics WHERE id = ?'
        ).bind(comicId).first();
        if (!comic) {
            return Response.json({ success: false, error: '漫画不存在' }, { status: 404 });
        }

        const timestamp = new Date(comic.uploaded_at).getTime() || Date.now();
        const folderName = `${timestamp}_${comic.title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}`;

        // 生成分片列表
        const parts = [];
        for (let i = 1; i <= total_parts; i++) {
            parts.push(`part_${i}.zip`);
        }

        const info = {
            title: comic.title,
            author: comic.author,
            chapters: comic.chapters,
            total_pages: total_pages,
            total_parts: total_parts,
            parts: parts
        };

        const infoBase64 = btoa(unescape(encodeURIComponent(JSON.stringify(info, null, 2))));

        const headers = {
            'Authorization': `token ${env.GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': 'application/json',
            'User-Agent': 'Manga-Site-Uploader/1.0'
        };
        const branch = 'main';

        const fileName = `${folderName}/info.json`;
        const res = await fetch(`https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${fileName}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({
                message: `Add info.json for comic ${comicId}`,
                content: infoBase64,
                branch
            })
        });

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`生成 info.json 失败: ${res.status} ${errorText}`);
        }

        // 更新数据库中的 zip_url 为 info.json 的链接
        const rawBase = `https://raw.githubusercontent.com/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/${branch}`;
        const infoUrl = `${rawBase}/${fileName}`;
        await env.DB.prepare(
            'UPDATE comics SET zip_url = ? WHERE id = ?'
        ).bind(infoUrl, comicId).run();

        return Response.json({ success: true, infoUrl });
    } catch (err) {
        console.error('Finish upload error:', err);
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}
