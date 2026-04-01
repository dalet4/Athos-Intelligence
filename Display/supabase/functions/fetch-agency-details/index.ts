import { corsHeaders } from "../_shared/cors.ts"

// Force TS to recognize Deno global constant to avoid IDE missing type errors
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any;

Deno.serve(async (req: Request) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { status: 200, headers: corsHeaders })
    }

    try {
        let { url, name, companyNumber, autoSelect, model: requestedModel } = await req.json();

        if (!url && !name && !companyNumber) {
            return new Response(
                JSON.stringify({ error: 'Either URL, name, or companyNumber is required' }),
                {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                }
            )
        }

        if (url && !/^https?:\/\//i.test(url)) {
            url = 'https://' + url;
        }

        let extractedData: any = {};

        // --- 1. LLM EXTRACTION ---
        if (url || name) {
            console.log(`Fetching comprehensive details for: ${url || name}`)

            let combinedText = "";
            let image = "";

            if (url) {
                const response = await fetch(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                    }
                })

                if (!response.ok) {
                    // Don't throw, just log and fallback to name-only guess
                    console.warn(`Failed to fetch URL: ${response.statusText}`);
                } else {
                    const html = await response.text()

                    // Strip HTML tags to save tokens
                    combinedText = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                        .replace(/<[^>]*>/g, ' ')
                        .replace(/\s+/g, ' ')
                        .trim();

                    // Cap text length to save tokens (e.g. 30,000 chars is plenty for homepage)
                    combinedText = combinedText.substring(0, 30000);

                    // Restore image metadata
                    const metaTags = html.match(/<meta[^>]+>/gim) || []
                    for (const tag of metaTags) {
                        const nameMatch = tag.match(/(?:name|property)=["']([^"']+)["']/i)
                        const contentMatch = tag.match(/content=["']([^"']+)["']/i)
                        if (nameMatch && contentMatch) {
                            const tagMetaName = nameMatch[1].toLowerCase()
                            if (tagMetaName === 'og:image' || tagMetaName === 'twitter:image') {
                                image = contentMatch[1]
                            }
                        }
                    }
                }
            }

            const apiKey = Deno.env.get('OPENAI_API_KEY') || Deno.env.get('OPENROUTER_API_KEY');
            if (!apiKey) {
                throw new Error("Missing OPENAI_API_KEY environment variable. Make sure it is set in your Supabase project.");
            }

            const isOpenRouter = !!Deno.env.get('OPENROUTER_API_KEY');
            const apiUrl = isOpenRouter ? "https://openrouter.ai/api/v1/chat/completions" : "https://api.openai.com/v1/chat/completions";
            const defaultModel = isOpenRouter ? "openai/gpt-4o-mini" : "gpt-4o-mini";
            const model = requestedModel || defaultModel;

            const systemPrompt = `
You are an expert Commerce Intelligence Analyst.
Your goal is to extract structured JSON data from the agency website text (if provided) or from your general knowledge of the agency industry.

Extract the following JSON structure strictly. Do not return markdown, just raw JSON.

{
    "name": "Agency Name",
    "website": "URL (e.g. https://example.com)",
    "description": "Short summary (max 200 chars)",
    "revenue": "$XM-$YM",
    "clients": [
        {"name": "Client Name"}
    ],
    "awards": [
        {"name": "Award Name", "year": "Year"}
    ],
    "directors": [
        {"name": "Full Name", "role": "Job Title", "linkedin_url": "URL"}
    ],
    "case_studies": [
        {"title": "Title", "url": "URL"}
    ],
    "partner_managers": [
        {"name": "Full Name", "role": "Job Title", "linkedin_url": "URL"}
    ],
    "partners": ["List", "of", "technology", "partners", "e.g. Shopify, BigCommerce"],
    "specializations": ["List", "of", "services"],
    "platforms": ["Shopify", "Magento", "Salesforce"]
}

CRITICAL INSTRUCTIONS:
1. For 'revenue', ESTIMATE based on employee count/team size (~$150k/head) and clients. Return a range string e.g. "$5M-$10M". Look for "team of 50+" etc.
2. Directors: Extract key leadership (Founder, CEO, Director, Head of). Look for names in the text.
3. Partners: Look for technology partners (Shopify, BigCommerce, Klaviyo, Yotpo, Gorgias, Recharge, etc.).
4. Return ONLY valid JSON, no backticks, no markdown blocks.
5. Clients: If you spot names of brands they work with.
6. Partner Managers: Deeply scan for people whose job titles indicate they manage partnerships, alliances, channel relations, or ecosystem growth (e.g., "Partnerships Manager", "Head of Alliances", "Partner Lead"). Extract their Name, Role, and LinkedIn URL if available.
`;

            console.log("Calling LLM API for extraction...");
            const llmResponse = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: url ? `URL: ${url}\n\nWebsite Text:\n${combinedText}` : `Agency Name: ${name}\n\nPlease generate a comprehensive profile for this agency using your internal knowledge. Include their verified website URL if known.` }
                    ],
                    response_format: { type: "json_object" }
                })
            });

            if (!llmResponse.ok) {
                const errBody = await llmResponse.text();
                throw new Error(`LLM API Error: ${llmResponse.status} - ${errBody}`);
            }

            const llmResult = await llmResponse.json();
            try {
                extractedData = JSON.parse(llmResult.choices[0].message.content);
            } catch (e) {
                console.error("Failed to parse LLM JSON:", llmResult.choices[0].message.content);
                throw new Error("Invalid format from LLM");
            }

            // Log usage to Supabase for cost tracking
            try {
                const usage = llmResult.usage;
                if (usage) {
                    const PRICING: Record<string, [number, number]> = {
                        "openai/gpt-4o-mini":            [0.15,  0.60],
                        "openai/gpt-4o-mini-2024-07-18": [0.15,  0.60],
                        "gpt-4o-mini":                   [0.15,  0.60],
                        "openai/gpt-4o-2024-08-06":      [2.50,  10.00],
                        "openai/gpt-4o":                 [5.00,  15.00],
                        "google/gemini-flash-1.5":        [0.075, 0.30],
                        "google/gemini-2.0-flash-001":    [0.10,  0.40],
                        "anthropic/claude-3-haiku":       [0.25,  1.25],
                        "anthropic/claude-3.5-haiku":     [0.80,  4.00],
                        "openai/gpt-4-turbo-preview":     [10.00, 30.00],
                    };
                    const [inPrice, outPrice] = PRICING[model] ?? [0, 0];
                    const cost = (usage.prompt_tokens / 1_000_000) * inPrice +
                                 (usage.completion_tokens / 1_000_000) * outPrice;

                    const supabaseUrl = Deno.env.get('SUPABASE_URL');
                    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
                    if (supabaseUrl && supabaseKey) {
                        await fetch(`${supabaseUrl}/rest/v1/llm_usage`, {
                            method: 'POST',
                            headers: {
                                'apikey': supabaseKey,
                                'Authorization': `Bearer ${supabaseKey}`,
                                'Content-Type': 'application/json',
                                'Prefer': 'return=minimal',
                            },
                            body: JSON.stringify({
                                model,
                                task: 'structured_extraction',
                                prompt_tokens: usage.prompt_tokens,
                                completion_tokens: usage.completion_tokens,
                                cost,
                                source: 'edge_function',
                            }),
                        });
                    }
                }
            } catch (logErr) {
                console.warn("Usage logging failed (non-fatal):", logErr);
            }

            if (url) {
                extractedData.website = url;
            }
            if (image) {
                extractedData.image = image;
            }
            if (!extractedData.name && name) {
                extractedData.name = name;
            }
        } else if (name) {
            extractedData.name = name;
        }

        // --- 2. ENRICHMENT VIA COMPANIES HOUSE API ---
        const chApiKey = Deno.env.get('COMPANIES_HOUSE_API_KEY');
        let selectedCompanyNumber = companyNumber;

        // If no specifically chosen companyNumber is provided, we search CH by name
        if (chApiKey && !selectedCompanyNumber && extractedData.name) {
            console.log(`Starting Companies House Search for: ${extractedData.name}`);
            const authHeader = `Basic ${btoa(chApiKey + ':')}`;

            try {
                const searchRes = await fetch(`https://api.company-information.service.gov.uk/search/companies?q=${encodeURIComponent(extractedData.name)}`, {
                    headers: { 'Authorization': authHeader }
                });

                if (searchRes.ok) {
                    const searchData = await searchRes.json();

                    if (searchData.items && searchData.items.length > 0) {
                        // If multiple results and no URL context, ask user to disambiguate
                        if (!url && searchData.items.length > 1 && !autoSelect) {
                            console.log(`Found ${searchData.items.length} matches for ${extractedData.name}, returning disambiguation list.`);
                            return new Response(
                                JSON.stringify({
                                    action: "select_company",
                                    companies: searchData.items.map((i: any) => ({
                                        title: i.title,
                                        company_number: i.company_number,
                                        address: i.address_snippet
                                    }))
                                }),
                                {
                                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                                    status: 200,
                                }
                            );
                        }

                        // Otherwise, we blindly pick the top match 
                        selectedCompanyNumber = searchData.items[0].company_number;
                    } else {
                        console.log("No Companies House match found for:", extractedData.name);
                    }
                } else {
                    console.warn("Companies house search failed:", searchRes.status);
                }
            } catch (err) {
                console.error("Error during Companies House search:", err);
            }
        }

        // --- 3. FETCH FULL DETAILS IF A SPECIFIC ID IS SECURED ---
        if (chApiKey && selectedCompanyNumber) {
            console.log(`Fetching specific CH record: ${selectedCompanyNumber}`);
            const authHeader = `Basic ${btoa(chApiKey + ':')}`;

            try {
                // Profile Data
                const profileRes = await fetch(`https://api.company-information.service.gov.uk/company/${selectedCompanyNumber}`, {
                    headers: { 'Authorization': authHeader }
                });

                if (profileRes.ok) {
                    const topMatch = await profileRes.json();

                    // Blend in foundation data
                    extractedData.official_name = topMatch.company_name;
                    if (!url) {
                        extractedData.name = topMatch.company_name; // Fallback to official name if manual entry
                    }

                    if (topMatch.registered_office_address) {
                        extractedData.address = [
                            topMatch.registered_office_address.address_line_1,
                            topMatch.registered_office_address.locality,
                            topMatch.registered_office_address.postal_code,
                            topMatch.registered_office_address.country
                        ].filter(Boolean).join(', ');
                    }

                    if (topMatch.date_of_creation) {
                        extractedData.founded_year = topMatch.date_of_creation.split('-')[0];
                    }
                }

                // Fetch Active Directors
                const officersRes = await fetch(`https://api.company-information.service.gov.uk/company/${selectedCompanyNumber}/officers`, {
                    headers: { 'Authorization': authHeader }
                });

                if (officersRes.ok) {
                    const officersData = await officersRes.json();
                    if (officersData.items) {
                        const activeDirectors = officersData.items.filter((o: any) =>
                            !o.resigned_on && o.officer_role.includes('director')
                        );

                        if (activeDirectors.length > 0) {
                            extractedData.directors = activeDirectors.map((d: any) => ({
                                name: d.name,
                                role: d.officer_role,
                                linkedin_url: ''
                            }));
                        }
                    }
                } else {
                    console.warn("Companies house officers fetch failed:", officersRes.status);
                }

            } catch (err) {
                console.error("Error during final Companies House detailing:", err);
            }
        } else if (!chApiKey) {
            console.log("Skipping Companies House Enrichment - Missing Key");
        }
        // --- END ENRICHMENT ---

        console.log(`Extracted data for ${extractedData.name}:`, JSON.stringify(extractedData).substring(0, 100) + '...');

        return new Response(
            JSON.stringify(extractedData),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        )

    } catch (error: any) {
        console.error('Error:', error)
        return new Response(
            JSON.stringify({ error: error.message || 'Unknown error' }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 500,
            }
        )
    }
})
