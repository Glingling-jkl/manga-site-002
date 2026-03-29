// functions/api/docs/content.js
export async function onRequestGet(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const path = url.searchParams.get('path');
    if (!path) {
        return Response.json({ success: false, error: '缺少文件路径' }, { status: 400 });
    }

    // 使用环境变量，如果没有则使用默认值（根据你的实际情况修改）
    const owner = env.GITHUB_OWNER || 'Glingling-jkl';      // 你的GitHub用户名
    const repo = env.GITHUB_REPO || 'manga-storage';        // 你的存储库名
    const branch = env.GITHUB_BRANCH || 'main';             // 分支名，可能是 main 或 master

    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/docs/${path}`;
    console.log('[DEBUG] Fetching docs from:', rawUrl);      // 调试日志

    try {
        const response = await fetch(rawUrl);
        if (!response.ok) {
            console.error(`[ERROR] GitHub returned ${response.status} for ${rawUrl}`);
            return Response.json({ success: false, error: `文件不存在 (${response.status})` }, { status: response.status });
        }
        const text = await response.text();
        return new Response(text, {
            headers: {
                'Content-Type': 'text/markdown; charset=utf-8',
                'Access-Control-Allow-Origin': '*'
            }
        });
    } catch (err) {
        console.error('[ERROR] Fetch failed:', err);
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}
