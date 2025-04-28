export const config = {
    runtime: 'edge',
};

export default async function handler(req: Request) {
    if (req.method !== 'GET') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            // 1st chunk
            controller.enqueue(encoder.encode('First part of the image...'));
            await new Promise((resolve) => setTimeout(resolve, 2000)); // 2초 대기

            // 2nd chunk
            controller.enqueue(encoder.encode('Second part of the image...'));
            await new Promise((resolve) => setTimeout(resolve, 2000)); // 또 2초 대기

            // 3rd chunk
            controller.enqueue(encoder.encode('Last part of the image!'));

            controller.close();
        },
    });

    return new Response(stream, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'text/plain', // 이미지라면 여기를 'image/png'로 수정
        },
    });
}
