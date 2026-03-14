export async function onRequestGet(context) {
    const { env, params } = context;
    const id = params.id;
    try {
        const comic = await env.DB.prepare(
            'SELECT * FROM comics WHERE id = ?'
        ).bind(id).first();
        if (!comic) {
            return Response.json({ success: false, error: '漫画不存在' }, { status: 404 });
        }
        comic.tags = JSON.parse(comic.tags || '[]');
        return Response.json({ success: true, data: comic });
    } catch (err) {
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}