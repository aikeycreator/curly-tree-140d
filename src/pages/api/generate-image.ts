export const config = {
    runtime: 'edge', // Cloudflare Pages 환경에서 Workers처럼 동작하게 함
};

const MAX_REQUESTS_PER_DAY = 20;

function getTodayKey(ip: string) {
    const today = new Date().toISOString().slice(0, 10);
    return `${ip}_${today}`;
}

export default async function handler(req: Request, ctx: any) {
    if (req.method === 'POST') {
        // ... (existing POST logic remains unchanged)
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
        const apiKey = process.env.OPENAI_API_KEY || ctx?.env?.OPENAI_API_KEY;
        if (!apiKey) {
            return new Response('API key not set', { status: 500 });
        }
        const openaiRes = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'dall-e-3',
                prompt,
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
   

    // Method not allowed fallback
    return new Response('Method Not Allowed', { status: 405 });
}
