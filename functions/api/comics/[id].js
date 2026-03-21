// functions/api/comics/[id].js
export async function onRequest(context) {
    const { request, env, params } = context;
    const id = params.id;
    const method = request.method;

    if (method === 'GET') {
        return handleGet(request, env, id);
    } else if (method === 'DELETE') {
        return handleDelete(request, env, id);
    } else {
        return new Response('Method Not Allowed', { status: 405 });
    }
}

async function handleGet(request, env, id) {
    const userId = request.headers.get('X-Auth-UserId');
    try {
        const comic = await env.DB.prepare(
            'SELECT * FROM comics WHERE id = ?'
        ).bind(id).first();
        if (!comic) {
            return Response.json({ success: false, error: '漫画不存在' }, { status: 404 });
        }
        comic.tags = JSON.parse(comic.tags || '[]');

        // 检查成人内容权限
        if (comic.is_adult === 'yes') {
            if (!userId) {
                return Response.json({ success: false, error: '此内容需要登录才能查看' }, { status: 403 });
            }
            const user = await env.DB.prepare('SELECT allow_adult FROM users WHERE id = ?').bind(userId).first();
            if (!user || user.allow_adult !== 'yes') {
                return Response.json({ success: false, error: '您未允许查看高危内容，请在用户管理或联系管理员开启' }, { status: 403 });
            }
        }

        return Response.json({ success: true, data: comic });
    } catch (err) {
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}

async function handleDelete(request, env, id) {
    // 保持原有的删除逻辑不变
    const uploadToken = request.headers.get('X-Upload-Token');
    if (uploadToken !== env.ADMIN_UPLOAD_TOKEN) {
        return Response.json({ success: false, error: '无权限' }, { status: 403 });
    }

    const authRole = request.headers.get('X-Auth-Role') || '';
    if (!authRole) {
        return Response.json({ success: false, error: '未提供身份信息' }, { status: 403 });
    }

    try {
        const comic = await env.DB.prepare(
            'SELECT cover_url, zip_url, owner_role FROM comics WHERE id = ?'
        ).bind(id).first();
        if (!comic) {
            return Response.json({ success: false, error: '漫画不存在' }, { status: 404 });
        }

        if (authRole === 'system') {
            // system 可删所有
        } else if (authRole === 'admin' && comic.owner_role !== 'system') {
            // admin 可删非 system 的漫画
        } else {
            return Response.json({ success: false, error: '无权删除此漫画' }, { status: 403 });
        }

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
        const branch = 'main';

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

function extractPathFromMirror(url) {
    let rawPart = url;
    if (url.includes('ghproxy.com')) {
        rawPart = url.split('ghproxy.com/')[1];
    }
    const match = rawPart.match(/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/[^/]+\/(.+)/);
    return match ? match[1] : null;
    }
