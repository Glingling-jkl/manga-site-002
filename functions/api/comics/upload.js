export async function onRequestPost(context) {
    const { env } = context;
    // 仅读取，不操作，看函数是否还能工作
    console.log('HF_TOKEN exists:', !!env.HF_TOKEN); // 仅用于日志，不影响返回
    return Response.json({ success: true, message: 'env read' });
}
export async function onRequestGet() {
    return new Response('Method Not Allowed', { status: 405 });
}