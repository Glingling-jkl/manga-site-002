// functions/api/proxy.js
export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const fileUrl = url.searchParams.get('url');

    if (!fileUrl) {
        return new Response('Missing url parameter', { status: 400 });
    }

    try {
        const kvKey = `file:${fileUrl}`;

        // 1. 尝试从 KV 读取
        const cached = await env.FILE_CACHE.get(kvKey, { type: 'arrayBuffer' });
        if (cached !== null) {
            console.log(`KV 命中: ${fileUrl}`);
            let contentType = getContentType(fileUrl);
            return new Response(cached, {
                headers: {
                    'Content-Type': contentType,
                    'Cache-Control': 'public, max-age=86400',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }

        // 2. 未命中，从 GitHub 获取
        console.log(`KV 未命中，从 GitHub 获取: ${fileUrl}`);
        const response = await fetch(fileUrl, {
            headers: {
                'User-Agent': 'Manga-Site-Proxy/1.0',
                'Range': request.headers.get('Range') || ''
            }
        });

        if (!response.ok) {
            return new Response(`Failed to fetch: ${response.status}`, { 
                status: response.status,
                headers: { 'Access-Control-Allow-Origin': '*' }
            });
        }

        const blob = await response.arrayBuffer();

        // 3. 存入 KV，有效期 30 天
        await env.FILE_CACHE.put(kvKey, blob, { expirationTtl: 2592000 });
        console.log(`KV 写入成功: ${fileUrl}`);

        // 4. 返回文件
        let contentType = getContentType(fileUrl);
        return new Response(blob, {
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=86400',
                'Access-Control-Allow-Origin': '*'
            }
        });
    } catch (err) {
        console.error('Proxy error:', err);
        return new Response(`Proxy error: ${err.message}`, { 
            status: 500,
            headers: { 'Access-Control-Allow-Origin': '*' }
        });
    }
}

function getContentType(fileUrl) {
    const ext = fileUrl.split('.').pop().split('?')[0].toLowerCase();
    const mimeMap = {
        'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
        'png': 'image/png', 'gif': 'image/gif',
        'webp': 'image/webp', 'zip': 'application/zip',
        'json': 'application/json'
    };
    return mimeMap[ext] || 'application/octet-stream';
}
