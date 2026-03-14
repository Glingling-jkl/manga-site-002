// functions/api/comics/upload.js (调试版)
export async function onRequestPost(context) {
    try {
        const { request, env } = context;

        // 收集环境变量信息
        const envInfo = {
            HF_TOKEN_exists: !!env.HF_TOKEN,
            HF_SPACE_exists: !!env.HF_SPACE,
            ADMIN_UPLOAD_TOKEN_exists: !!env.ADMIN_UPLOAD_TOKEN,
            HF_TOKEN_length: env.HF_TOKEN ? env.HF_TOKEN.length : 0,
            HF_SPACE_value: env.HF_SPACE || 'undefined',
            // 注意：不要直接打印令牌值，避免泄露
        };

        // 收集请求头信息
        const headers = {};
        for (const [key, value] of request.headers.entries()) {
            headers[key] = value;
        }
        const uploadTokenHeader = request.headers.get('X-Upload-Token');

        // 尝试解析表单数据（如果存在）
        let formDataInfo = {};
        try {
            const formData = await request.formData();
            formDataInfo = {
                title: formData.get('title') || 'missing',
                author: formData.get('author') || 'missing',
                tags: formData.get('tags') || 'missing',
                chapters: formData.get('chapters') || 'missing',
                pages: formData.get('pages') || 'missing',
                description: formData.get('description') || 'missing',
                cover: formData.get('cover') ? '存在' : 'missing',
                zip: formData.get('zip') ? '存在' : 'missing',
            };
        } catch (formErr) {
            formDataInfo = { error: '解析表单失败: ' + formErr.message };
        }

        return Response.json({
            success: true,
            debug: {
                env: envInfo,
                headers: headers,
                uploadTokenHeader: uploadTokenHeader,
                formData: formDataInfo,
            }
        });
    } catch (err) {
        return Response.json({
            success: false,
            error: '函数内捕获到错误: ' + err.message,
            stack: err.stack
        }, { status: 500 });
    }
}

export async function onRequestGet() {
    return new Response('Method Not Allowed', { status: 405 });
}