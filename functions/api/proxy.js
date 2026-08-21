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
        const isHead = request.method === 'HEAD';
        const hasRange = !!request.headers.get('Range');

        // 需要透传给客户端的响应头（含 Range 相关头，供分片/断点下载使用）
        const passthroughHeaders = [
            'content-type', 'content-length', 'content-range', 'accept-ranges',
            'cache-control', 'etag', 'last-modified'
        ];

        function buildHeaders(source, extra = {}) {
            const headers = new Headers();
            for (const h of passthroughHeaders) {
                const v = source.headers.get(h);
                if (v) headers.set(h, v);
            }
            headers.set('Access-Control-Allow-Origin', '*');
            for (const [k, v] of Object.entries(extra)) headers.set(k, v);
            return headers;
        }

        // HEAD 请求：直接转发上游，不缓存
        if (isHead) {
            const headRes = await fetch(fileUrl, {
                method: 'HEAD',
                headers: { 'User-Agent': 'Manga-Site-Proxy/1.0' }
            });
            return new Response(null, { status: headRes.status, headers: buildHeaders(headRes) });
        }

        // 1. 尝试从 KV 读取（仅缓存小体积内容，如封面图片）
        const cached = await env.FILE_CACHE.get(kvKey, { type: 'arrayBuffer' });
        if (cached !== null) {
            return new Response(cached, buildHeaders(
                { headers: new Headers({ 'Content-Type': getContentType(fileUrl) }) },
                { 'Cache-Control': 'public, max-age=86400' }
            ));
        }

        // 2. 未命中，从 GitHub 获取
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

        const contentType = response.headers.get('content-type') || getContentType(fileUrl);
        const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
        const isImage = contentType.startsWith('image/');

        // 3. 小体积图片（非 Range 请求）：完整读入并缓存到 KV（KV 单值上限 25MB）
        if (isImage && !hasRange && contentLength > 0 && contentLength <= 5 * 1024 * 1024) {
            const blob = await response.arrayBuffer();
            try {
                await env.FILE_CACHE.put(kvKey, blob, { expirationTtl: 2592000 });
            } catch (kvErr) {
                console.error('KV 写入失败（不影响返回）:', kvErr.message);
            }
            return new Response(blob, buildHeaders(
                { headers: new Headers({ 'Content-Type': contentType }) },
                { 'Cache-Control': 'public, max-age=86400' }
            ));
        }

        // 4. 其余（ZIP / 分片 / JSON / 大文件等）：流式转发，立即返回，不经过 KV。
        //    避免 KV 25MB 限制与写入阻塞造成的“请求挂起 + 进度 0%”
        return new Response(response.body, {
            status: response.status,
            headers: buildHeaders(response, { 'Cache-Control': 'public, max-age=86400' })
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
