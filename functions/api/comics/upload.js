export async function onRequestPost(context) {
    const { request, env } = context;
    const token = request.headers.get('X-Upload-Token');
    return Response.json({ success: true, tokenReceived: token });
}