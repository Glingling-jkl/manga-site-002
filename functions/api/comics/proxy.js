// functions/api/proxy.js
export async function onRequestGet(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const fileUrl = url.searchParams.get('url');

    if (!fileUrl) {
        return new Response('Missing url parameter', { status: 400 });
    }

    try {
        // 从 GitHub 获取文件流
        const response = await fetch(fileUrl, {
            headers: {
                'User-Agent': 'Manga-Site-Proxy/1.0'
            }
        });

        if (!response.ok) {
            return new Response(`Failed to fetch: ${response.status}`, { status: response.status });
        }

        // 直接流式返回给客户端
        return new Response(response.body, {
            headers: {
                'Content-Type': 'application/zip',
                'Content-Disposition': 'inline', // 浏览器内打开
                'Cache-Control': 'public, max-age=3600',
                'Access-Control-Allow-Origin': '*'
            }
        });

    } catch (err) {
        return new Response(`Proxy error: ${err.message}`, { status: 500 });
    }
}
