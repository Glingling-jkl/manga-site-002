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

        // 获取漫画信息
        const comic = await env.DB.prepare(
            'SELECT title, uploaded_at FROM comics WHERE id = ?'
        ).bind(comicId).first();
        if (!comic) {
            return Response.json({ success: false, error: '漫画不存在' }, { status: 404 });
        }

        // 生成文件夹名
        const timestamp = new Date(comic.uploaded_at).getTime() || Date.now();
        const folderName = `${timestamp}_${comic.title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}`;
        // 关键：将分片保存到 parts 子目录下
        const fileName = `${folderName}/parts/${originalName}`;

        // 转换为 Base64
        const arrayBuffer = await zipFile.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);

        const headers = {
            'Authorization': `token ${env.GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': 'application/json',
            'User-Agent': 'Manga-Site-Uploader/1.0'
        };
        const branch = 'main';

        // 上传到 GitHub
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

        return Response.json({ success: true });
    } catch (err) {
        console.error('Upload part error:', err);
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}
