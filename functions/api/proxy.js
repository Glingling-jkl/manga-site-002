export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const fileUrl = url.searchParams.get('url');

    if (!fileUrl) {
        return new Response('Missing url', { status: 400 });
    }

    try {
        // 直接从 GitHub 获取并返回，不经过 KV
        const response = await fetch(fileUrl);
        const blob = await response.arrayBuffer();

        return new Response(blob, {
            headers: {
                'Content-Type': 'application/zip',
                'Access-Control-Allow-Origin': '*'
            }
        });
    } catch (err) {
        return new Response(`Proxy error: ${err.message}`, { status: 500 });
    }
}
