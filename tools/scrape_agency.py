
import os
import sys
import re
import argparse
import requests
import json
import time
from urllib.parse import urljoin, urlparse
from dotenv import load_dotenv
from typing import Optional
from cost_manager import CostManager

# Load .env explicitly
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))

FIRECRAWL_API_KEY = os.getenv("FIRECRAWL_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

TEAM_PAGE_PATTERN = re.compile(
    r'/(?:about|team|people|who-we-are|our-team|about-us|meet-the-team|leadership|staff|founders)(?:[/?#]|$)',
    re.IGNORECASE,
)

def find_team_pages(html: str, base_url: str) -> list:
    """Extract About/Team page URLs from raw HTML using link patterns."""
    base_domain = urlparse(base_url).netloc
    hrefs = re.findall(r'href=["\']([^"\'#?][^"\']*)["\']', html)
    seen, results = set(), []
    for href in hrefs:
        full_url = urljoin(base_url, href).split('#')[0].split('?')[0]
        if urlparse(full_url).netloc != base_domain:
            continue
        if TEAM_PAGE_PATTERN.search(full_url) and full_url not in seen:
            seen.add(full_url)
            results.append(full_url)
    return results[:2]  # max 2 subpages


def scrape_markdown_with_subpages(url: str) -> dict:
    """Fetch homepage + About/Team subpages and return combined markdown."""
    try:
        import html2text
    except ImportError:
        return {"error": "html2text not installed. Run: pip3 install html2text"}

    headers = {"User-Agent": "Mozilla/5.0 (compatible; AthosBot/1.0)"}
    h = html2text.HTML2Text()
    h.ignore_links = False
    h.ignore_images = True
    h.body_width = 0

    try:
        resp = requests.get(url, headers=headers, timeout=30, allow_redirects=True)
        resp.raise_for_status()
    except Exception as e:
        return {"error": f"Failed to fetch {url}: {str(e)}"}

    home_html = resp.text
    combined = f"--- SOURCE: HOMEPAGE ({url}) ---\n{h.handle(home_html)}\n"

    subpages = find_team_pages(home_html, url)
    for sub_url in subpages:
        sys.stderr.write(f"[fallback] fetching subpage: {sub_url}\n")
        try:
            sub = requests.get(sub_url, headers=headers, timeout=30, allow_redirects=True)
            sub.raise_for_status()
            combined += f"\n\n--- SOURCE: SUBPAGE ({sub_url}) ---\n{h.handle(sub.text)}\n"
            time.sleep(0.5)
        except Exception as e:
            sys.stderr.write(f"[fallback] skipping {sub_url}: {e}\n")

    sys.stderr.write(f"[fallback] scraped {url} + {len(subpages)} subpage(s) ({len(combined)} chars)\n")
    return {"markdown": combined, "url": url}


def scrape_url_fallback(url: str) -> dict:
    """Fallback scraper using requests + html2text when Firecrawl is unavailable."""
    try:
        import html2text
    except ImportError:
        return {"error": "html2text not installed. Run: pip3 install html2text"}
    try:
        headers = {"User-Agent": "Mozilla/5.0 (compatible; AthosBot/1.0)"}
        resp = requests.get(url, headers=headers, timeout=30, allow_redirects=True)
        resp.raise_for_status()
        h = html2text.HTML2Text()
        h.ignore_links = False
        h.ignore_images = True
        h.body_width = 0
        markdown = h.handle(resp.text)
        sys.stderr.write(f"[fallback] scraped {url} ({len(markdown)} chars)\n")
        return {"markdown": markdown, "url": url}
    except Exception as e:
        return {"error": f"Fallback scrape failed: {str(e)}"}


def scrape_url(url: str):
    """Scrapes a single URL using Firecrawl, falling back to html2text on failure."""
    if FIRECRAWL_API_KEY:
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
            sys.stderr.write(f"[firecrawl] failed ({response.status_code}), using fallback\n")
        except Exception as e:
            sys.stderr.write(f"[firecrawl] exception ({e}), using fallback\n")
    else:
        sys.stderr.write("[firecrawl] no API key, using fallback\n")

    return scrape_url_fallback(url)

def find_subpages(home_markdown, base_url, run_id: Optional[str] = None, model: Optional[str] = None):
    """Uses LLM to find About/Team/Partners links in the homepage markdown."""
    api_key = OPENROUTER_API_KEY or OPENAI_API_KEY
    if not api_key:
        return []

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    if OPENROUTER_API_KEY:
        api_url = "https://openrouter.ai/api/v1/chat/completions"
        model_name = model or "google/gemini-flash-1.5"
    else:
        api_url = "https://api.openai.com/v1/chat/completions"
        model_name = model or "gpt-4o-mini"
    
    prompt = f"""
    Analyze the markdown links from this homepage and identify the URLs for:
    1. "About Us" or "Company" page.
    2. "Team" or "People" page (for Directors).
    3. "Partners" or "Technology" page.
    4. "Careers" or "Jobs" page (for hiring signals).
    
    Return a JSON object with keys "about_url", "team_url", "partners_url", "careers_url". 
    If not found, use null. Convert relative paths to absolute URLs using base: {base_url}.
    """
    
    payload = {
        "model": model_name, 
        "messages": [
            {"role": "system", "content": "You are a URL extractor. Return JSON only."},
            {"role": "user", "content": prompt + "\n\nMarkdown Snippet (Start):\n" + home_markdown[:80000] + "\n\nMarkdown Snippet (End):\n" + home_markdown[-5000:]} 
        ],
        "response_format": { "type": "json_object" }
    }
    
    try:
        resp = requests.post(api_url, json=payload, headers=headers, timeout=30)
        if resp.status_code == 200:
            content = resp.json()['choices'][0]['message']['content']
            links = json.loads(content)
            # Filter nulls and duplicates
            urls = []
            if links.get('about_url'): urls.append(links['about_url'])
            if links.get('team_url'): urls.append(links['team_url'])
            if links.get('partners_url'): urls.append(links['partners_url'])
            if links.get('careers_url'): urls.append(links['careers_url'])
            # Basic validation
            valid_urls = [u for u in urls if u and u.startswith('http')]
            
            # Record Cost
            if run_id:
                usage_data = resp.json().get('usage')
                if usage_data:
                    cm = CostManager()
                    cm.record_usage(
                        run_id=run_id,
                        model=model_name,
                        prompt_tokens=usage_data.get("prompt_tokens", 0),
                        completion_tokens=usage_data.get("completion_tokens", 0)
                    )

            return list(set(valid_urls))
        else:
            sys.stderr.write(f"Link Analysis Failed: {resp.text}\n")
    except Exception as e:
        sys.stderr.write(f"Link Analysis Exception: {str(e)}\n")
    return []

def extract_with_llm(content, run_id: Optional[str] = None, model: Optional[str] = None):
    """
    Sends massive context to LLM to extract structured JSON matching Expanded Schema.
    """
    api_key = OPENROUTER_API_KEY or OPENAI_API_KEY
    if not api_key:
        return {"error": "Missing OPENROUTER_API_KEY or OPENAI_API_KEY"}

    headers = {
        "Authorization": f"Bearer {api_key}",
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
    
    # OpenRouter requires an extra header for routing if we use it directly via requests
    if OPENROUTER_API_KEY:
        api_url = "https://openrouter.ai/api/v1/chat/completions"
        model_name = model or "openai/gpt-4o-mini"
    else:
        api_url = "https://api.openai.com/v1/chat/completions"
        model_name = model or "gpt-4o-mini"

    payload = {
        "model": model_name, 
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Extract data from this consolidated website content:\n\n{content[:40000]}"} # Large context
        ],
        "response_format": { "type": "json_object" }
    }
    
    try:
        resp = requests.post(api_url, json=payload, headers=headers, timeout=45)
        if resp.status_code == 200:
            # Record Cost
            if run_id:
                usage_data = resp.json().get('usage')
                if usage_data:
                    cm = CostManager()
                    cm.record_usage(
                        run_id=run_id,
                        model=model_name,
                        prompt_tokens=usage_data.get("prompt_tokens", 0),
                        completion_tokens=usage_data.get("completion_tokens", 0)
                    )
            return json.loads(resp.json()['choices'][0]['message']['content'])
        else:
            return {"error": f"LLM Error {resp.status_code}: {resp.text}"}
    except Exception as e:
        return {"error": f"Extraction failed: {str(e)}"}

def scrape_agency_crawler(start_url: str, run_id: Optional[str] = None, model: Optional[str] = None):
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
    subpages = find_subpages(home_markdown, start_url, run_id=run_id, model=model)
    
    # 3. Scrape Subpages (Max 3 to save time/tokens)
    for url in subpages[:3]:
        sys.stderr.write(json.dumps({"status": "crawling_subpage", "url": url}) + "\n")
        sub_data = scrape_url(url)
        if "markdown" in sub_data:
            consolidated_content += f"\n\n--- SOURCE: SUBPAGE ({url}) ---\n{sub_data['markdown']}\n"
        time.sleep(1) # Be polite
        
    # Extraction and Enrichment are no longer the responsibility of this tool.
    # They are handled by extract_insights.py and store_data.py respectively.
    
    result = {
        "success": True,
        "url": start_url,
        "crawled_pages": [start_url] + subpages[:2],
        "markdown": consolidated_content
    }
    print(json.dumps(result))

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Deep crawl agency website.")
    parser.add_argument("--url", required=True, help="The URL to start crawling.")
    parser.add_argument("--run-id", help="Orchestration Run ID for cost tracking")
    parser.add_argument("--model", help="Override LLM model for link extraction.")
    parser.add_argument("--markdown-only", action="store_true",
                        help="Output raw markdown text only (for caching to .md files).")
    args = parser.parse_args()

    if args.markdown_only:
        # Multi-page scrape (homepage + About/Team subpages), output plain markdown for caching
        result = scrape_markdown_with_subpages(args.url)
        if "error" in result:
            sys.stderr.write(json.dumps(result) + "\n")
            sys.exit(1)
        print(result["markdown"])
    else:
        scrape_agency_crawler(args.url, run_id=args.run_id, model=args.model)
