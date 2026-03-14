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

/**
 * 处理 GET 请求：获取单本漫画详情
 */
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
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}

/**
 * 处理 DELETE 请求：删除漫画（数据库 + GitHub 文件）
 */
async function handleDelete(request, env, id) {
    // 验证管理员令牌
    const uploadToken = request.headers.get('X-Upload-Token');
    if (uploadToken !== env.ADMIN_UPLOAD_TOKEN) {
        return Response.json({ success: false, error: '无权限' }, { status: 403 });
    }

    try {
        // 1. 从数据库获取漫画信息
        const comic = await env.DB.prepare(
            'SELECT * FROM comics WHERE id = ?'
        ).bind(id).first();
        if (!comic) {
            return Response.json({ success: false, error: '漫画不存在' }, { status: 404 });
        }

        // 2. 从封面和ZIP链接中提取 GitHub 文件路径
        const { cover_url, zip_url } = comic;
        const coverPath = extractGitHubPath(cover_url);
        const zipPath = extractGitHubPath(zip_url);
        if (!coverPath || !zipPath) {
            throw new Error('无法解析文件路径，请检查链接格式');
        }

        // 3. 准备 GitHub API 请求头（必须包含 User-Agent）
        const headers = {
            'Authorization': `token ${env.GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': 'application/json',
            'User-Agent': 'Manga-Site-Admin/1.0'  // 必须设置，否则 GitHub 会返回 403
        };
        const branch = 'main'; // 根据你的仓库默认分支调整

        // 4. 辅助函数：获取文件的 SHA
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

        // 5. 辅助函数：删除文件
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

        // 6. 执行删除：先获取 SHA，再删除文件
        const coverSha = await getFileSha(coverPath);
        const zipSha = await getFileSha(zipPath);
        await deleteFile(coverPath, coverSha);
        await deleteFile(zipPath, zipSha);

        // 7. 从数据库中删除记录
        await env.DB.prepare('DELETE FROM comics WHERE id = ?').bind(id).run();

        return Response.json({ success: true, message: '删除成功' });
    } catch (err) {
        console.error('Delete error:', err);
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}

/**
 * 从 GitHub raw 链接提取文件路径
 * 支持格式：https://raw.githubusercontent.com/owner/repo/branch/path/to/file
 */
function extractGitHubPath(url) {
    const match = url.match(/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/[^/]+\/(.+)/);
    return match ? match[1] : null;
}
