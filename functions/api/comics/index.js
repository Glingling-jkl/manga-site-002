export async function onRequestGet(context) {
    const { env } = context;
    try {
        const { results } = await env.DB.prepare(
            'SELECT * FROM comics ORDER BY uploaded_at DESC'
        ).all();
        const comics = results.map(c => ({
            ...c,
            tags: JSON.parse(c.tags || '[]')
        }));
        return Response.json({ success: true, data: comics });
    } catch (err) {
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}