// functions/api/proxy.js
export async function onRequestGet(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const fileUrl = url.searchParams.get('url');

    if (!fileUrl) {
        return new Response('Missing url parameter', { status: 400 });
    }

    try {
        // 尝试从缓存中获取
        const cache = caches.default;
        let cachedResponse = await cache.match(request);
        if (cachedResponse) {
            console.log('Cache HIT');
            return cachedResponse;
        }

        console.log('Cache MISS, fetching from origin');

        // 从 GitHub 获取文件，带上原始请求的 Range 头（如果有）
        const originResponse = await fetch(fileUrl, {
            headers: {
                'User-Agent': 'Manga-Site-Proxy/1.0',
                'Range': request.headers.get('Range') || ''  // 透传 Range
            }
        });

        if (!originResponse.ok) {
            return new Response(`Failed to fetch: ${originResponse.status}`, { status: originResponse.status });
        }

        // 构造新响应，保留必要的头
        const newHeaders = new Headers(originResponse.headers);
        newHeaders.set('Access-Control-Allow-Origin', '*');
        newHeaders.set('Cache-Control', 'public, max-age=86400'); // 缓存 24 小时
        newHeaders.set('Content-Type', 'application/zip');

        const newResponse = new Response(originResponse.body, {
            status: originResponse.status,
            statusText: originResponse.statusText,
            headers: newHeaders
        });

        // 异步存入缓存
        context.waitUntil(cache.put(request, newResponse.clone()));

        return newResponse;
    } catch (err) {
        return new Response(`Proxy error: ${err.message}`, { status: 500 });
    }
}
