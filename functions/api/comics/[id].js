// functions/api/comics/[id].js
export async function onRequest(context) {
    const { request, env, params } = context;
    const id = params.id;
    const method = request.method;

    if (method === 'GET') {
        return handleGet(env, id);
    } else if (method === 'DELETE') {
        return handleDelete(request, env, id);
    } else {
        return new Response('Method Not Allowed', { status: 405 });
    }
}

async function handleGet(env, id) {
    try {
        const comic = await env.DB.prepare(
            'SELECT * FROM comics WHERE id = ?'
        ).bind(id).first();
        if (!comic) {
            return Response.json({ success: false, error: '漫画不存在' }, { status: 404 });
        }
        comic.tags = JSON.parse(comic.tags || '[]');
        return Response.json({ success: true, data: comic });
    } catch (err) {
        console.error('GET error:', err);
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}

async function handleDelete(request, env, id) {
    // 验证管理员令牌
    const uploadToken = request.headers.get('X-Upload-Token');
    if (uploadToken !== env.ADMIN_UPLOAD_TOKEN) {
        return Response.json({ success: false, error: '无权限' }, { status: 403 });
    }

    // 获取当前用户角色（不再需要用户名）
    const authRole = request.headers.get('X-Auth-Role') || '';
    if (!authRole) {
        return Response.json({ success: false, error: '未提供身份信息' }, { status: 403 });
    }

    try {
        // 获取漫画信息，包括所有者角色
        const comic = await env.DB.prepare(
            'SELECT cover_url, zip_url, owner_role FROM comics WHERE id = ?'
        ).bind(id).first();
        if (!comic) {
            return Response.json({ success: false, error: '漫画不存在' }, { status: 404 });
        }

        // 权限判断
        if (authRole === 'system') {
            // system 可删所有
        } else if (authRole === 'admin' && comic.owner_role !== 'system') {
            // admin 可删非 system 的漫画
        } else {
            return Response.json({ success: false, error: '无权删除此漫画' }, { status: 403 });
        }

        // 从链接中提取 GitHub 文件路径（兼容原始 raw 和镜像）
        const coverPath = extractPathFromMirror(comic.cover_url);
        const zipPath = extractPathFromMirror(comic.zip_url);
        if (!coverPath || !zipPath) {
            throw new Error('无法解析文件路径');
        }

        const headers = {
            'Authorization': `token ${env.GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': 'application/json',
            'User-Agent': 'Manga-Site-Admin/1.0'
        };
        const branch = 'main'; // 根据你的仓库默认分支调整

        async function getFileSha(path) {
            const url = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${path}?ref=${branch}`;
            const res = await fetch(url, { headers });
            if (!res.ok) {
                const err = await res.text();
                throw new Error(`获取文件信息失败: ${res.status} ${err}`);
            }
            const data = await res.json();
            return data.sha;
        }

        async function deleteFile(path, sha) {
            const url = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${path}`;
            const body = {
                message: `Delete ${path} via manga admin`,
                sha: sha,
                branch: branch
            };
            const res = await fetch(url, {
                method: 'DELETE',
                headers,
                body: JSON.stringify(body)
            });
            if (!res.ok) {
                const err = await res.text();
                throw new Error(`删除文件失败: ${res.status} ${err}`);
            }
        }

        const coverSha = await getFileSha(coverPath);
        const zipSha = await getFileSha(zipPath);
        await deleteFile(coverPath, coverSha);
        await deleteFile(zipPath, zipSha);

        await env.DB.prepare('DELETE FROM comics WHERE id = ?').bind(id).run();

        return Response.json({ success: true, message: '删除成功' });
    } catch (err) {
        console.error('Delete error:', err);
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}

/**
 * 从镜像链接提取 GitHub 文件路径
 * 支持格式：
 * - https://ghproxy.com/https://raw.githubusercontent.com/owner/repo/branch/path
 * - https://raw.githubusercontent.com/owner/repo/branch/path
 */
function extractPathFromMirror(url) {
    let rawPart = url;
    if (url.includes('ghproxy.com')) {
        rawPart = url.split('ghproxy.com/')[1];
    }
    const match = rawPart.match(/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/[^/]+\/(.+)/);
    return match ? match[1] : null;
}
