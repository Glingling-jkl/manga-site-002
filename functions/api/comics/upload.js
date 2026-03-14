export async function onRequestPost(context) {
    const { request, env } = context;
    try {
        // 测试环境变量是否存在
        if (!env.HF_TOKEN) throw new Error('HF_TOKEN 未设置');
        if (!env.HF_SPACE) throw new Error('HF_SPACE 未设置');
        if (!env.ADMIN_UPLOAD_TOKEN) throw new Error('ADMIN_UPLOAD_TOKEN 未设置');

        const uploadToken = request.headers.get('X-Upload-Token');
        if (uploadToken !== env.ADMIN_UPLOAD_TOKEN) {
            return Response.json({ success: false, error: '令牌错误' }, { status: 403 });
        }

        // 其他逻辑...
        return Response.json({ success: true, message: '环境变量正常，令牌正确' });
    } catch (err) {
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}