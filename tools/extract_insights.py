
import os
import sys
import argparse
import json
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from openai import OpenAI

# Load .env
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

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

class Agency(BaseModel):
    name: str = Field(description="Name of the agency")
    description: str = Field(description="Concise description of the agency")
    website: str = Field(description="The URL of the agency website")
    specializations: List[str] = Field(default=[], description="List of services offered (e.g. SEO, PPC)")
    platforms: List[str] = Field(default=[], description="List of supported platforms")
    revenue_estimate: Optional[str] = Field(default=None, description="Estimated revenue range if mentioned")
    clients: List[Client] = Field(default=[])
    case_studies: List[CaseStudy] = Field(default=[])
    last_analyzed: str = Field(default_factory=lambda: datetime.utcnow().isoformat())

# --- Tool Logic ---
def extract_insights(markdown_content: str, website_url: str):
    if not OPENROUTER_API_KEY:
        print(json.dumps({"error": "Missing OPENROUTER_API_KEY"}))
        return

    client = OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=OPENROUTER_API_KEY,
    )

    prompt = f"""
    You are an expert Commerce Intelligence Analyst.
    Your goal is to extract structured data about a digital agency from the provided website markdown.
    
    Website URL: {website_url}
    
    Content:
    {markdown_content[:20000]} # Truncate to avoid context limits if huge
    
    Extract the following JSON structure strictly.
    """

    try:
        completion = client.chat.completions.create(
            model="openai/gpt-4o-2024-08-06", # Or generic supported model
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
            
        except Exception as validation_error:
            print(json.dumps({"error": f"Validation Error: {str(validation_error)}", "raw": raw_json}))

    except Exception as e:
        print(json.dumps({"error": f"LLM Error: {str(e)}"}))

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Extract insights from Agency markdown.")
    parser.add_argument("--file", help="Path to markdown file")
    parser.add_argument("--url", required=True, help="Original URL of the agency")
    args = parser.parse_args()
    
    content = ""
    if args.file:
        with open(args.file, 'r') as f:
            content = f.read()
    else:
        # Read from stdin
        content = sys.stdin.read()
        
    extract_insights(content, args.url)
