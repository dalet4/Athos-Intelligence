
import os
import sys
import argparse
import requests
import json
import time
from dotenv import load_dotenv

# Load .env explicitly
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))

FIRECRAWL_API_KEY = os.getenv("FIRECRAWL_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

def scrape_url(url: str):
    """Scrapes a single URL using Firecrawl."""
    if not FIRECRAWL_API_KEY:
        return {"error": "Missing FIRECRAWL_API_KEY"}
    
    api_url = "https://api.firecrawl.dev/v0/scrape"
    headers = {
        "Authorization": f"Bearer {FIRECRAWL_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "url": url,
        "pageOptions": {"onlyMainContent": True}
    }
    
    try:
        response = requests.post(api_url, json=payload, headers=headers, timeout=60)
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                return {"markdown": data.get('data', {}).get('markdown', ''), "url": url}
        return {"error": f"Firecrawl Status {response.status_code}"}
    except Exception as e:
        return {"error": str(e)}

def find_subpages(home_markdown, base_url):
    """Uses LLM to find About/Team/Partners links in the homepage markdown."""
    if not OPENAI_API_KEY:
        return []

    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "Content-Type": "application/json"
    }
    
    prompt = f"""
    Analyze the markdown links from this homepage and identify the URLs for:
    1. "About Us" or "Company" page.
    2. "Team" or "People" page (for Directors).
    3. "Partners" or "Technology" page.
    
    Return a JSON object with keys "about_url" and "partners_url". 
    If not found, use null. Convert relative paths to absolute URLs using base: {base_url}.
    """
    
    payload = {
        "model": "gpt-4-turbo-preview", 
        "messages": [
            {"role": "system", "content": "You are a URL extractor. Return JSON only."},
            {"role": "user", "content": prompt + "\n\nMarkdown Snippet:\n" + home_markdown[:10000]} 
        ],
        "response_format": { "type": "json_object" }
    }
    
    try:
        resp = requests.post("https://api.openai.com/v1/chat/completions", json=payload, headers=headers, timeout=30)
        if resp.status_code == 200:
            links = json.loads(resp.json()['choices'][0]['message']['content'])
            # Filter nulls and duplicates
            urls = []
            if links.get('about_url'): urls.append(links['about_url'])
            if links.get('partners_url'): urls.append(links['partners_url'])
            # Basic validation
            valid_urls = [u for u in urls if u and u.startswith('http')]
            return list(set(valid_urls))
    except:
        pass
    return []

def extract_with_openai(content):
    """
    Sends massive context to OpenAI to extract structured JSON matching Expanded Schema.
    """
    if not OPENAI_API_KEY:
        return {"error": "Missing OPENAI_API_KEY"}

    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "Content-Type": "application/json"
    }
    
    system_prompt = """
    You are an expert Data Extractor. Extract the following JSON schema from the Agency Website content provided (which may include Homepage, About Us, and Partners pages).
    
    Schema:
    {
        "name": "Agency Name",
        "description": "Short summary (max 200 chars)",
        "website": "Agency URL",
        "partner_page_url": "URL of the specific partners page if found",
        "services": ["List", "of", "services", "offered"],
        "platforms": ["Shopify", "Magento", "Salesforce", "etc (See constraints)"],
        "partners": ["List", "of", "technology", "partners", "e.g. Yotpo, Klaviyo"],
        "clients": [
            {"name": "Client Name", "industry": "Industry", "platform": "Platform"}
        ],
        "case_studies": [
            {"title": "Title", "url": "Full URL to case study if found, else null"}
        ],
        "revenue_estimate": "$XM-$YM",
        "awards": [
            {"name": "Award Name", "year": "Year"}
        ],
        "directors": [
            {"name": "Full Name", "role": "Job Title", "linkedin_url": "LinkedIn Profile URL"}
        ]
    }
    
    IMPORTANT: 
    - For 'revenue_estimate', ESTIMATE based on employee count (~$150k/head) and client tier. Return range e.g. "$5M-$10M".
    - For 'directors', look for "Founder", "CEO", "Director", "Head of".
    - For 'awards', extracts specifically named awards.
    - For 'platforms', check specifically for these TARGETS: 3dCart, Able Commerce, Agnostic, ASP.net, AspDotNetStorefront, BigCommerce, Core Commerce, Custom, Epi Server, IBM Websphere, Magento, Miva, NetSuite, nopCommerce, Oracle ATG, OROCommerce, PinnacleCart, Salesforce Commerce Cloud, SAP Hybris, Shopify, Shopware, Site Core, Volusion, Weblinc, WooCommerce, Yahoo!, Centra, Shopline, Remarkable, Adobe Commerce, Aero.
    
    Return ONLY valid JSON.
    """
    
    payload = {
        "model": "gpt-4-turbo-preview", 
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Extract data from this consolidated website content:\n\n{content[:40000]}"} # Large context
        ],
        "response_format": { "type": "json_object" }
    }
    
    try:
        resp = requests.post("https://api.openai.com/v1/chat/completions", json=payload, headers=headers, timeout=45)
        if resp.status_code == 200:
            return json.loads(resp.json()['choices'][0]['message']['content'])
        else:
            return {"error": f"OpenAI Error {resp.status_code}: {resp.text}"}
    except Exception as e:
        return {"error": f"Extraction failed: {str(e)}"}

def scrape_agency_crawler(start_url: str):
    """Main Crawler Loop"""
    # 1. Scrape Homepage
    sys.stderr.write(json.dumps({"status": "starting", "url": start_url}) + "\n")
    
    home_data = scrape_url(start_url)
    if "error" in home_data:
        print(json.dumps(home_data))
        return

    home_markdown = home_data['markdown']
    consolidated_content = f"--- SOURCE: HOMEPAGE ({start_url}) ---\n{home_markdown}\n"

    # 2. Find Subpages
    sys.stderr.write(json.dumps({"status": "analyzing_links"}) + "\n")
    subpages = find_subpages(home_markdown, start_url)
    
    # 3. Scrape Subpages (Max 2 to save time/tokens)
    for url in subpages[:2]:
        sys.stderr.write(json.dumps({"status": "crawling_subpage", "url": url}) + "\n")
        sub_data = scrape_url(url)
        if "markdown" in sub_data:
            consolidated_content += f"\n\n--- SOURCE: SUBPAGE ({url}) ---\n{sub_data['markdown']}\n"
        time.sleep(1) # Be polite

    # 4. Extract Intelligence
    sys.stderr.write(json.dumps({"status": "extracting_intelligence"}) + "\n")
    extracted_data = extract_with_openai(consolidated_content)
    
    # 5. Enrich with Hunter.io (Emails)
    hunter_key = os.getenv("HUNTER_API_KEY")
    if hunter_key:
        sys.stderr.write(json.dumps({"status": "enriching_with_hunter"}) + "\n")
        try:
            from enrich_hunter import enrich_with_hunter
            hunter_directors = enrich_with_hunter(start_url, hunter_key)
            
            # Merge logic: Append Hunter directors to OpenAI directors
            # In a real app, we would deduplicate by name similarity
            current_directors = extracted_data.get("directors", [])
            
            # Simple dedupe by exact name match
            existing_names = {d.get("name").lower() for d in current_directors if d.get("name")}
            
            for hd in hunter_directors:
                if hd.get("name") and hd.get("name").lower() not in existing_names:
                    current_directors.append(hd)
                elif hd.get("name") and hd.get("name").lower() in existing_names:
                    # Enrich existing record with email if missing
                    for d in current_directors:
                        if d.get("name").lower() == hd.get("name").lower() and not d.get("email"):
                            d["email"] = hd.get("email")
                            d["role"] = d.get("role") or hd.get("role") # Fallback role
                            
            extracted_data["directors"] = current_directors
            
        except Exception as e:
            sys.stderr.write(json.dumps({"warning": f"Hunter enrichment failed: {str(e)}"}) + "\n")
    
    # Validation & Output
    if "error" not in extracted_data:
        extracted_data["website"] = start_url # Enforce Source of Truth
    
    result = {
        "success": True,
        "url": start_url,
        "crawled_pages": [start_url] + subpages[:2],
        "data": extracted_data
    }
    print(json.dumps(result))

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Deep crawl agency website.")
    parser.add_argument("--url", required=True, help="The URL to start crawling.")
    args = parser.parse_args()
    
    scrape_agency_crawler(args.url)
