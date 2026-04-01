
import os
import sys
import argparse
import json
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from openai import OpenAI
from cost_manager import CostManager

# Load .env
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# --- Pydantic Schema ---
class Client(BaseModel):
    name: str = Field(description="Name of the client")
    project_summary: str = Field(description="Brief summary of work done for the client")
    industry: str = Field(default="Unknown", description="Industry the client belongs to")
    platform: str = Field(default="Unknown", description="Platform used (e.g. Shopify, Magento)")

class CaseStudy(BaseModel):
    title: str = Field(description="Title of the case study")
    url: str = Field(default="", description="URL to the case study")
    results: List[str] = Field(default=[], description="List of quantitative results (e.g. '20% growth')")

class Director(BaseModel):
    name: str = Field(description="Full Name")
    role: str = Field(description="Job Title")
    linkedin_url: Optional[str] = Field(default=None, description="LinkedIn Profile URL")

class Award(BaseModel):
    name: str = Field(description="Award Name")
    year: Optional[str] = Field(default=None, description="Year")

class Agency(BaseModel):
    name: str = Field(description="Name of the agency")
    description: str = Field(description="Concise description of the agency")
    website: str = Field(description="The URL of the agency website")
    partner_page_url: Optional[str] = Field(default=None, description="URL of the specific partners page if found")
    specializations: List[str] = Field(default=[], description="List of services offered (e.g. SEO, PPC)")
    platforms: List[str] = Field(default=[], description="List of supported platforms")
    competitor_partnerships: List[str] = Field(default=[], description="Competitor tech partnerships (e.g. Klaviyo, Yotpo, Gorgias)")
    revenue_estimate: Optional[str] = Field(default=None, description="Estimated revenue range if mentioned")
    open_roles_count: int = Field(default=0, description="Estimated number of open roles found on careers page")
    hiring_roles: List[str] = Field(default=[], description="Titles of key open roles e.g. 'Senior Developer'")
    parent_company: Optional[str] = Field(default=None, description="The name of the parent company or group if applicable (e.g. MSQ, WPP)")
    is_part_of_group: bool = Field(default=False, description="Whether the agency is part of a larger group or parent company")
    headcount: Optional[str] = Field(default=None, description="Estimated number of employees e.g. '50-100'")
    office_locations: List[str] = Field(default=[], description="Primary office cities/countries")
    tech_stack: List[str] = Field(default=[], description="Technologies used or implemented e.g. ['Shopify', 'Klaviyo', 'React']")
    recent_news: List[str] = Field(default=[], description="Headlines of recent news/blog posts from 2024-2025")
    clients: List[Client] = Field(default=[])
    case_studies: List[CaseStudy] = Field(default=[])
    directors: List[Director] = Field(default=[])
    partner_managers: List[Director] = Field(default=[])
    awards: List[Award] = Field(default=[])
    last_analyzed: str = Field(default_factory=lambda: datetime.utcnow().isoformat())

# --- Tool Logic ---
def extract_insights(markdown_content: str, website_url: str, run_id: Optional[str] = None, model: Optional[str] = None):
    api_key = OPENROUTER_API_KEY or OPENAI_API_KEY
    base_url = "https://openrouter.ai/api/v1" if OPENROUTER_API_KEY else None
    if model is None:
        model = "openai/gpt-4o-mini" if OPENROUTER_API_KEY else "gpt-4o-mini"

    if not api_key:
        print(json.dumps({"error": "Missing OPENROUTER_API_KEY or OPENAI_API_KEY"}))
        return

    client = OpenAI(
        base_url=base_url,
        api_key=api_key,
    )

    prompt = f"""
    You are an expert Commerce Intelligence Analyst.
    Your goal is to extract structured data from the agency website content.
    
    Website URL: {website_url}
    
    Agency Content:
    {markdown_content[:25000]} 
    
    Extract the following JSON structure strictly.
    
    CRITICAL INSTRUCTIONS:
    1. **Growth Signals**: Look for a "Careers" section or mentions of hiring. Count the open roles. Extract specific role titles.
    2. **News**: Look for "Press", "News", or "Blog" for recent (2024-2025) achievements, awards, or expansions.
    3. **Competitor Intelligence**: deeply scan for mentions of technology partnerships. 
       - Specifically look for: Klaviyo, Yotpo, Gorgias, Recharge, Attentive, Postscript, Okendo, Reviews.io, Loop Returns.
       - These are our DIRECT COMPETITORS. If they are mentioned as partners, ensure they are listed in 'competitor_partnerships'.
       - Also detailed platforms: Shopify, Magento, BigCommerce, Salesforce.
    4. **Valuation/Revenue**: For 'revenue_estimate', strictly ESTIMATE based on employee count (~$150k/head) and client tier. Return a range string e.g. "$5M-$10M". DO NOT leave it blank if you can infer team size.
    5. **Description**: Write a `description` of at least 100 characters summarising the agency's focus, key services, and target market. Synthesise from all available content — do not leave this short or generic.
    6. **Company Intelligence**:
       - **Headcount**: Look for mentions of team size or "Our team of X experts".
       - **Office Locations**: Extract primary office cities.
       - **Tech Stack**: Beyond platforms, look for specific tech mentioned (e.g. Headless, Gatsby, Vue, Netlify, Next.js, React, Hydrogen). If no tech is explicitly named, infer from the services language (e.g. "headless commerce" → Headless; "custom Shopify development" → Shopify, React). Always return at least 2 items if the agency does any technical work.
    7. **Partnership Roles**: Deeply scan for people whose job titles indicate they manage partnerships, alliances, channel relations, or ecosystem growth. Look for titles like "Partnerships Manager", "Head of Alliances", "Partner Lead", "Channel Manager", or "Ecommerce Partnerships". Extract their Name, Role, and LinkedIn URL if available.
    8. **Hiring/Growth**: Deeply analyze the "Careers" or "Job" sections found in the content to get an accurate count and specific titles for hiring roles.
    9. **Group/Parent Company**: Identify if the agency is part of a larger group (e.g., MSQ, WPP, Publicis, Dentsu, various private equity groups). Look for keywords like "Part of [Group]", "subsidiary of", "an [Group] agency", or "our parent company [Group]". If found, set 'is_part_of_group' to true and provide the 'parent_company' name.
    10. **Leadership/Directors**: Scan "About", "Team", or "Meet the Team" sections for senior leadership. Extract anyone with titles like "Founder", "Co-Founder", "CEO", "Managing Director", "Director", "CTO", "COO", or "Head of [Department]" into the `directors` field with their full name, role, and LinkedIn URL if visible. This field must not be left empty if any named individuals appear on the site.
    """

    try:
        completion = client.chat.completions.create(
            model=model, # Or generic supported model
            messages=[
                {"role": "system", "content": "You are a helpful assistant that extracts structured JSON."},
                {"role": "user", "content": prompt}
            ],
            response_format={
                "type": "json_schema", 
                "json_schema": {
                    "name": "agency_schema",
                    "schema": Agency.model_json_schema()
                }
            }
        )
        
        raw_json = completion.choices[0].message.content
        
        # Validation
        try:
            agency_data = Agency.model_validate_json(raw_json)
            # Ensure website is set if LLM missed it or assumed
            if not agency_data.website or agency_data.website == "unknown":
                agency_data.website = website_url
                
            print(agency_data.model_dump_json(indent=2))
            
            # Record Cost
            if run_id:
                usage = completion.usage
                cm = CostManager()
                cm.record_usage(
                    run_id=run_id,
                    model=model,
                    prompt_tokens=usage.prompt_tokens,
                    completion_tokens=usage.completion_tokens
                )
            
        except Exception as validation_error:
            print(json.dumps({"error": f"Validation Error: {str(validation_error)}", "raw": raw_json}))

    except Exception as e:
        print(json.dumps({"error": f"LLM Error: {str(e)}"}))

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Extract insights from Agency markdown.")
    parser.add_argument("--file", help="Path to markdown file")
    parser.add_argument("--url", required=True, help="Original URL of the agency")
    parser.add_argument("--run-id", help="Orchestration Run ID for cost tracking")
    parser.add_argument("--model", help="Override LLM model (e.g. openai/gpt-4o-mini). Run 'python cost_manager.py --models' to see options.")
    args = parser.parse_args()

    content = ""
    if args.file:
        with open(args.file, 'r') as f:
            content = f.read()
    else:
        # Read from stdin
        content = sys.stdin.read()

    extract_insights(content, args.url, run_id=args.run_id, model=args.model)
