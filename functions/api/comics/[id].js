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
        const comic = await env.DB.prepare('SELECT * FROM comics WHERE id = ?').bind(id).first();
        if (!comic) {
            return Response.json({ success: false, error: '漫画不存在' }, { status: 404 });
        }
        comic.tags = JSON.parse(comic.tags || '[]');

        if (comic.is_adult === 'yes') {
            if (!userId) {
                return Response.json({ success: false, error: '此内容需要登录才能查看' }, { status: 403 });
            }
            const user = await env.DB.prepare('SELECT adult_enabled, allow_adult FROM users WHERE id = ?').bind(userId).first();
            if (!user || user.adult_enabled !== 'yes' || user.allow_adult !== 'yes') {
                return Response.json({ success: false, error: '您未获得查看高危内容的权限，或您已关闭显示' }, { status: 403 });
            }
        }

        return Response.json({ success: true, data: comic });
    } catch (err) {
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}

async function handleDelete(request, env, id) {
    const uploadToken = request.headers.get('X-Upload-Token');
    if (uploadToken !== env.ADMIN_UPLOAD_TOKEN) {
        return Response.json({ success: false, error: '无权限' }, { status: 403 });
    }

    const authRole = request.headers.get('X-Auth-Role') || '';
    if (!authRole) {
        return Response.json({ success: false, error: '未提供身份信息' }, { status: 403 });
    }

    try {
        const comic = await env.DB.prepare('SELECT * FROM comics WHERE id = ?').bind(id).first();
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

        // 1. 清理 KV 缓存
        try {
            // 封面
            if (comic.cover_url) {
                const coverKey = `file:${comic.cover_url}`;
                await env.FILE_CACHE.delete(coverKey);
                console.log('KV 已删除封面:', coverKey);
            }
            // info.json 和分片
            const infoUrl = comic.zip_url;
            if (infoUrl) {
                const infoKey = `file:${infoUrl}`;
                await env.FILE_CACHE.delete(infoKey);
                console.log('KV 已删除 info.json:', infoKey);
                
                const baseUrl = infoUrl.substring(0, infoUrl.lastIndexOf('/'));
                for (let i = 1; i <= comic.total_parts; i++) {
                    const partUrl = `${baseUrl}/zips/part_${i}.zip`;
                    const partKey = `file:${partUrl}`;
                    await env.FILE_CACHE.delete(partKey);
                }
                console.log('KV 已删除所有分片');
            }
        } catch (kvErr) {
            console.error('KV 清理失败（不影响删除）:', kvErr);
        }

        // 2. 从 GitHub 删除文件
        const rawBase = `https://raw.githubusercontent.com/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/main/`;
        if (!comic.zip_url.startsWith(rawBase)) {
            throw new Error('无法解析漫画文件夹路径');
        }
        const folderPath = comic.zip_url.substring(rawBase.length).replace('/info.json', '');
        if (!folderPath) {
            throw new Error('文件夹路径无效');
        }

        const headers = {
            'Authorization': `token ${env.GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'Manga-Site-Admin/1.0'
        };
        const branch = 'main';

        async function getAllFilesInFolder(path) {
            const url = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${path}?ref=${branch}`;
            const res = await fetch(url, { headers });
            if (!res.ok) {
                if (res.status === 404) return [];
                const err = await res.text();
                throw new Error(`获取文件夹内容失败: ${res.status} ${err}`);
            }
            const items = await res.json();
            let files = [];
            for (const item of items) {
                if (item.type === 'file') {
                    files.push(item);
                } else if (item.type === 'dir') {
                    const subFiles = await getAllFilesInFolder(item.path);
                    files.push(...subFiles);
                }
            }
            return files;
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

        const files = await getAllFilesInFolder(folderPath);
        for (const file of files) {
            await deleteFile(file.path, file.sha);
        }

        // 3. 删除数据库记录
        await env.DB.prepare('DELETE FROM comics WHERE id = ?').bind(id).run();

        return Response.json({ success: true, message: '删除成功' });
    } catch (err) {
        console.error('Delete error:', err);
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}
