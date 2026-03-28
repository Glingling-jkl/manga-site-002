export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const fileUrl = url.searchParams.get('url');

    if (!fileUrl) {
        return new Response('Missing url', { status: 400 });
    }

    try {
        const kvKey = `file:${fileUrl}`;

        // 1. 尝试从 KV 读取
        const cached = await env.FILE_CACHE.get(kvKey, { type: 'arrayBuffer' });
        if (cached !== null) {
            console.log(`KV 命中: ${fileUrl}`);
            return new Response(cached, {
                headers: {
                    'Content-Type': 'application/zip',
                    'Access-Control-Allow-Origin': '*',
                    'X-KV-Hit': 'true'
                }
            });
        }

        // 2. 未命中，从 GitHub 获取
        console.log(`KV 未命中，从 GitHub 获取: ${fileUrl}`);
        const response = await fetch(fileUrl);
        if (!response.ok) {
            return new Response(`GitHub fetch failed: ${response.status}`, { status: response.status });
        }
        const blob = await response.arrayBuffer();

        // 3. 写入 KV
        await env.FILE_CACHE.put(kvKey, blob, { expirationTtl: 2592000 });
        console.log(`KV 写入成功: ${fileUrl}`);

        // 4. 返回
        return new Response(blob, {
            headers: {
                'Content-Type': 'application/zip',
                'Access-Control-Allow-Origin': '*',
                'X-KV-Write-Status': 'success'
            }
        });
    } catch (err) {
        console.error('Proxy error:', err);
        return new Response(`Proxy error: ${err.message}`, { status: 500 });
    }
}
