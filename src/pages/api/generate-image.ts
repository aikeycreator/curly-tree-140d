// edge.js (edge runtime specific code)
export const config = {
    runtime: 'edge',
};

const MAX_REQUESTS_PER_DAY = 20;

function getTodayKey(ip: string) {
    const today = new Date().toISOString().slice(0, 10);
    return `${ip}_${today}`;
}

export default async function edgeHandler(req: Request, ctx: ExecutionContext) {
    if (req.method === 'POST') {
        const ip = req.headers.get('cf-connecting-ip') || 'unknown';
        const key = getTodayKey(ip);
        const countRaw = await ctx.env?.RATE_LIMIT?.get(key);
        const count = parseInt(countRaw || '0');
        if (count >= MAX_REQUESTS_PER_DAY) {
            return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
                status: 429,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const body = await req.json();
        const prompt = body.prompt;
        if (!prompt) {
            return new Response(JSON.stringify({ error: 'Missing prompt' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const pre_prompt = `A glossy, 3D-style, minimal yet expressive emoji of a ${prompt}. She has soft round facial features, warm skin tone, and short brown hair. The emoji is centered with no background (transparent), rendered in the style of modern smartphone emojis. Use soft shadows and realistic lighting for a polished look.`;

        const apiKey = process.env.OPENAI_API_KEY || ctx?.env?.OPENAI_API_KEY;
        if (!apiKey) {
            return new Response('Unknown server error', { status: 500 });
        }

        const openaiRes = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'dall-e-3',
                prompt: pre_prompt,
                n: 1,
                size: '1024x1024',
                response_format: 'url',
            }),
        });

        if (!openaiRes.ok) {
            const errText = await openaiRes.text();
            return new Response(JSON.stringify({ error: errText }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const data = await openaiRes.json();
        const imageUrl = data.data[0].url;

        try {
            ctx?.env?.RATE_LIMIT?.put &&
            ctx.waitUntil(
                ctx.env.RATE_LIMIT.put(key, (count + 1).toString(), { expirationTtl: 86400 })
            );
        } catch (e) {
            console.warn('KV put failed (probably local dev):', e);
        }

        return new Response(JSON.stringify({ imageUrl }), {
            headers: { 'Content-Type': 'application/json' },
        });
    }

    return new Response('Method Not Allowed', { status: 405 });
}
