export async function onRequestPost(context) {
    const { env } = context;
    try {
        if (!env.HF_TOKEN) throw new Error('HF_TOKEN missing');
        if (!env.HF_SPACE) throw new Error('HF_SPACE missing');
        if (!env.ADMIN_UPLOAD_TOKEN) throw new Error('ADMIN_UPLOAD_TOKEN missing');
        return Response.json({ success: true, message: 'env vars ok' });
    } catch (err) {
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}