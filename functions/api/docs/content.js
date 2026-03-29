// functions/api/docs/content.js
export async function onRequestGet(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const path = url.searchParams.get('path');
    if (!path) {
        return Response.json({ success: false, error: '缺少文件路径' }, { status: 400 });
    }
    const rawUrl = `https://raw.githubusercontent.com/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/main/docs/${path}`;
    try {
        const response = await fetch(rawUrl);
        if (!response.ok) {
            return Response.json({ success: false, error: '文件不存在' }, { status: response.status });
        }
        const text = await response.text();
        return new Response(text, {
            headers: {
                'Content-Type': 'text/markdown; charset=utf-8',
                'Access-Control-Allow-Origin': '*'
            }
        });
    } catch (err) {
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}