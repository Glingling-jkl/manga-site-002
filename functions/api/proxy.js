// functions/api/proxy.js
export async function onRequestGet(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const fileUrl = url.searchParams.get('url');

    if (!fileUrl) {
        return new Response('Missing url parameter', { status: 400 });
    }

    try {
        // 尝试从 Cloudflare 缓存中获取
        const cache = caches.default;
        let cachedResponse = await cache.match(request);
        if (cachedResponse) {
            console.log('Cache HIT');
            return cachedResponse;
        }

        console.log('Cache MISS, fetching from origin');

        // 从 GitHub 获取文件
        const response = await fetch(fileUrl, {
            headers: {
                'User-Agent': 'Manga-Site-Proxy/1.0'
            }
        });

        if (!response.ok) {
            return new Response(`Failed to fetch: ${response.status}`, { status: response.status });
        }

        // 构造新的响应，添加缓存头
        const newResponse = new Response(response.body, {
            headers: {
                'Content-Type': 'application/zip',
                'Content-Disposition': 'inline',
                'Cache-Control': 'public, max-age=86400', // 缓存 24 小时
                'Access-Control-Allow-Origin': '*',
                'CF-Cache-Status': 'MISS' // 标记本次未命中
            }
        });

        // 将响应存入缓存（异步，不阻塞返回）
        context.waitUntil(cache.put(request, newResponse.clone()));

        return newResponse;
    } catch (err) {
        return new Response(`Proxy error: ${err.message}`, { status: 500 });
    }
}
