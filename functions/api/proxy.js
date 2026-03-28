export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const fileUrl = url.searchParams.get('url');

    if (!fileUrl) {
        return new Response('Missing url', { status: 400 });
    }

    try {
        // 从 GitHub 获取
        const response = await fetch(fileUrl);
        if (!response.ok) {
            return new Response(`GitHub fetch failed: ${response.status}`, { status: response.status });
        }
        const blob = await response.arrayBuffer();
        const blobSize = blob.byteLength;

        // 尝试写入 KV
        const kvKey = `file:${fileUrl}`;
        let kvWriteStatus = 'not_attempted';
        try {
            await env.FILE_CACHE.put(kvKey, blob, { expirationTtl: 2592000 });
            kvWriteStatus = 'success';
            console.log(`KV 写入成功: key=${kvKey}, size=${blobSize}`);
        } catch (kvErr) {
            kvWriteStatus = `failed: ${kvErr.message}`;
            console.error(`KV 写入失败: ${kvErr.message}`, kvErr);
        }

        // 返回文件，并在响应头中加入调试信息
        return new Response(blob, {
            headers: {
                'Content-Type': 'application/zip',
                'Access-Control-Allow-Origin': '*',
                'X-KV-Write-Status': kvWriteStatus,
                'X-Blob-Size': blobSize.toString()
            }
        });
    } catch (err) {
        return new Response(`Proxy error: ${err.message}`, { status: 500 });
    }
}
