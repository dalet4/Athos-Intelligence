export interface Client {
    name: string;
    industry?: string | null;
    platform?: string | null;
}

export interface Director {
    name: string;
    role: string;
    email?: string;
    linkedin_url?: string;
}

export interface Award {
    name: string;
    year: string;
}

export interface CaseStudy {
    title: string;
    url: string;
}

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
    clients: Client[] | null;
    case_studies: CaseStudy[] | null;
    directors?: Director[] | null;
    partner_managers?: Director[] | null;
    awards?: Award[] | null;
    partner_page_url?: string | null;
    lead_score?: number | null;
    score_breakdown?: {
        revenue: number;
        growth: number;
        alignment: number;
        competition: number;
        group_bonus?: number;
    } | null;
    parent_company?: string | null;
    is_group_member?: boolean | null;
    tech_stack?: string[] | null;
    headcount?: string | null;
    office_locations?: string[] | null;
    sibling_agencies?: string[] | null;
    [key: string]: any;
}
