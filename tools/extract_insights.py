
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

    system_prompt = """You are an expert Commerce Intelligence Analyst specialising in the UK/global ecommerce agency ecosystem.

Your task is to extract structured intelligence from scraped agency website content. You produce JSON only — no commentary.

## Extraction rules

**name / description / website**
- description must be ≥100 characters. Synthesise the agency's focus, key services, and target market from all available content. Never leave it generic ("a digital agency").

**specializations / platforms / tech_stack**
- specializations: service lines e.g. ["SEO", "PPC", "CRO", "Email Marketing"]
- platforms: commerce platforms e.g. ["Shopify", "Magento", "BigCommerce", "Salesforce Commerce Cloud"]
- tech_stack: specific technologies beyond platforms e.g. ["React", "Next.js", "Hydrogen", "Headless", "Gatsby", "Netlify", "Vue"]
  - If no tech is explicitly named, infer from service language: "headless commerce" → Headless; "custom Shopify development" → Shopify, React
  - Always return ≥2 items if the agency does any technical work

**competitor_partnerships**
- Scan deeply for technology partner mentions. Flag any of these as competitors: Klaviyo, Yotpo, Gorgias, Recharge, Attentive, Postscript, Okendo, Reviews.io, Loop Returns
- These are the intelligence buyer's direct competitors — be thorough

**revenue_estimate**
- Estimate from headcount using ~$150k/employee/year and client tier signals
- Always return a range string if team size can be inferred e.g. "$5M–$10M"
- Never leave null if headcount or team signals are present

**headcount**
- Look for "Our team of X", "X+ experts", LinkedIn employee counts, or career page job volume as a proxy
- Return a range string e.g. "50–100"

**open_roles_count / hiring_roles**
- Count every distinct open role in Careers/Jobs sections
- Extract specific titles e.g. ["Senior Shopify Developer", "Paid Media Manager"]

**directors**
- Scan About/Team/Meet the Team sections
- Include anyone titled: Founder, Co-Founder, CEO, MD, Director, CTO, COO, Head of [Department]
- Must not be empty if any named individuals appear on the site

**partner_managers**
- People whose titles indicate partnerships, alliances, or channel management
- Titles: "Partnerships Manager", "Head of Alliances", "Partner Lead", "Channel Manager", "Ecommerce Partnerships"

**parent_company / is_part_of_group**
- Look for: "Part of [Group]", "subsidiary of", "an [Group] agency", "our parent company"
- Known groups: MSQ, WPP, Publicis, Dentsu, Havas, and private equity roll-ups

**recent_news**
- Headlines from Press/News/Blog sections dated 2024–2025 only

**clients / case_studies**
- Extract named clients and any quantified results e.g. "20% revenue growth", "3× ROAS"

## Accuracy rules
- Never hallucinate. If information is absent, use null or empty list — do not guess.
- Do not infer competitor partnerships unless explicitly stated.
- Only extract directors and partner managers whose names appear in the content."""

    user_prompt = f"""Website URL: {website_url}

Agency Content:
{markdown_content[:25000]}"""

    try:
        completion = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
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
