// functions/api/docs/list.js
export async function onRequestGet(context) {
    const { env } = context;
    const indexUrl = `https://raw.githubusercontent.com/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/main/docs/index.json`;
    try {
        const response = await fetch(indexUrl);
        if (!response.ok) {
            return Response.json({ success: false, error: '无法获取文档目录' }, { status: response.status });
        }
        const data = await response.json();
        return Response.json({ success: true, data });
    } catch (err) {
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}