export async function onRequestPost(context) {
    const { request, env } = context;
    const token = request.headers.get('X-Upload-Token');
    if (token !== env.ADMIN_UPLOAD_TOKEN) {
        return Response.json({ success: false, error: 'invalid token' }, { status: 403 });
    }
    return Response.json({ success: true, message: 'token ok' });
}