// functions/api/proxy.js
export async function onRequestGet(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const fileUrl = url.searchParams.get('url');

    if (!fileUrl) {
        return new Response('Missing url parameter', { status: 400 });
    }

    try {
        const response = await fetch(fileUrl, {
            headers: {
                'User-Agent': 'Manga-Site-Proxy/1.0'
            }
        });

        // 检查 GitHub 返回的状态码
        if (!response.ok) {
            return new Response(`GitHub 返回错误: ${response.status} ${response.statusText}`, { status: response.status });
        }

        // 检查 Content-Type 是否是 ZIP
        const contentType = response.headers.get('Content-Type') || '';
        if (!contentType.includes('application/zip') && !contentType.includes('octet-stream') && !contentType.includes('binary')) {
            // 可能是错误页面，尝试读取部分内容并返回错误
            const text = await response.text();
            return new Response(`下载的内容不是 ZIP 文件 (Content-Type: ${contentType})。请检查链接是否正确。`, { status: 400 });
        }

        // 获取文件大小（如果有）
        const contentLength = response.headers.get('content-length');

        // 构建响应头
        const headers = {
            'Content-Type': 'application/zip',
            'Cache-Control': 'public, max-age=3600',
            'Access-Control-Allow-Origin': '*'
        };
        if (contentLength) {
            headers['Content-Length'] = contentLength;
        }

        // 直接流式返回
        return new Response(response.body, { headers });

    } catch (err) {
        return new Response(`代理错误: ${err.message}`, { status: 500 });
    }
}
