// functions/api/proxy.js
export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);

    // 处理 OPTIONS 预检请求
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
                'Access-Control-Allow-Headers': 'Range, Content-Type',
                'Access-Control-Max-Age': '86400',
            }
        });
    }

    // 只允许 GET 和 HEAD
    if (request.method !== 'GET' && request.method !== 'HEAD') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    const fileUrl = url.searchParams.get('url');
    if (!fileUrl) {
        return new Response('Missing url parameter', { status: 400 });
    }

    try {
        // 1. 尝试从 KV 读取（仅对 GET 请求缓存，HEAD 请求不缓存）
        let cached = null;
        if (request.method === 'GET') {
            const kvKey = `file:${fileUrl}`;
            cached = await env.FILE_CACHE.get(kvKey, { type: 'arrayBuffer' });
            if (cached !== null) {
                console.log('KV 命中:', fileUrl);
                let contentType = getContentType(fileUrl);
                return new Response(cached, {
                    headers: {
                        'Content-Type': contentType,
                        'Cache-Control': 'public, max-age=86400',
                        'Access-Control-Allow-Origin': '*'
                    }
                });
            }
        }

        // 2. 未命中，从 GitHub 获取
        console.log('KV 未命中，从 GitHub 获取:', fileUrl);
        const originResponse = await fetch(fileUrl, {
            headers: {
                'User-Agent': 'Manga-Site-Proxy/1.0',
                'Range': request.headers.get('Range') || ''
            }
        });

        if (!originResponse.ok) {
            return new Response(`Failed to fetch: ${originResponse.status}`, { 
                status: originResponse.status,
                headers: { 'Access-Control-Allow-Origin': '*' }
            });
        }

        // 如果是 HEAD 请求，直接返回响应头
        if (request.method === 'HEAD') {
            const headers = new Headers(originResponse.headers);
            headers.set('Access-Control-Allow-Origin', '*');
            return new Response(null, { headers });
        }

        // GET 请求：获取 body
        const blob = await originResponse.arrayBuffer();

        // 3. 存入 KV，有效期 30 天（必须在返回响应前完成，确保写入成功）
        const kvKey = `file:${fileUrl}`;
        try {
            await env.FILE_CACHE.put(kvKey, blob, { expirationTtl: 2592000 });
            console.log('KV 写入成功:', fileUrl);
        } catch (kvErr) {
            console.error('KV 写入失败:', kvErr);
        }

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
