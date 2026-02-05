export interface Agency {
    id: string;
    created_at: string;
    name: string;
    website: string;
    description: string | null;
    revenue_estimate: string | null;
    last_analyzed: string | null;
    specializations: string[] | null;
    platforms: string[] | null;
    partners?: string[] | null;
    clients: any[] | null; // JSONB
    case_studies: any[] | null; // JSONB
    directors?: { name: string; role: string; email?: string; linkedin_url?: string }[] | null;
    awards?: { name: string; year: string }[] | null;
    partner_page_url?: string | null;
}
