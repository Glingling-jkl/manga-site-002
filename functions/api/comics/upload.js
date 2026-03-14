export async function onRequestPost() {
    return Response.json({ success: true, message: 'upload route is alive' });
}