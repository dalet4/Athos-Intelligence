import { corsHeaders } from "../_shared/cors.ts"

declare const Deno: any;

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { status: 200, headers: corsHeaders })
    }

    try {
        const apiKey = Deno.env.get('OPENROUTER_API_KEY');
        if (!apiKey) {
            return new Response(
                JSON.stringify({ error: 'OPENROUTER_API_KEY not set' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });

        if (!res.ok) {
            throw new Error(`OpenRouter API error: ${res.status}`);
        }

        const { data } = await res.json();

        return new Response(
            JSON.stringify({
                usage: data.usage ?? 0,        // total USD spent
                limit: data.limit ?? null,      // credit limit, or null if unlimited
                is_free_tier: data.is_free_tier ?? false,
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (err: any) {
        return new Response(
            JSON.stringify({ available: false, error: err.message }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
