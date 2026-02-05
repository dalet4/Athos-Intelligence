
import modal
import sys
import os
import json
from tools.scrape_agency import scrape_agency
from tools.extract_insights import extract_insights
from tools.store_data import store_data

app = modal.App("athos-intelligence-platform")

# Define the image with dependencies
image = modal.Image.debian_slim().pip_install(
    "requests",
    "openai",
    "pydantic",
    "supabase",
    "python-dotenv"
).add_local_dir("tools", remote_path="/root/tools")

# Define secrets (assumes these are set in Modal dashboard or local .env if running locally with modal run)
# best practice is to create secrets in modal dashboard: modal secret create athos-secrets ...
secrets = [
    modal.Secret.from_name("athos-secrets")
]

@app.function(
    image=image, 
    secrets=secrets, 
    timeout=600 # Increased timeout for potential re-tries
)
@modal.web_endpoint(method="POST")
def analyze_agency_webhook(item: dict):
    """
    Webhook to trigger analysis via HTTP POST.
    Payload: {"url": "https://agency.com"}
    """
    url = item.get("url")
    if not url:
        return {"error": "Missing 'url' in payload"}
    
    # Check if analysis logic needs to run as a separate function or if we can call it directly.
    # calling .remote from a web endpoint is async/fire-and-forget usually, 
    # but here we might want to return the result if the client waits.
    # For long running tasks, better to return immediately and process in background,
    # but for simplicity let's run it. 
    # Actually, analyze_agency is a modal function. calling it normally inside the container works?
    # No, we separate the logic from the modal decorator if we want to reuse it, 
    # OR we use `analyze_agency.local(url)` if inside the container? 
    # Best practice: define `_analyze_logic` and call it from both.
    
    result = _analyze_logic(url) 
    return result

@app.function(
    image=image,
    secrets=secrets,
    timeout=600
)
def analyze_agency(url: str):
    """
    Modal function for manual remote triggering or cross-function calls.
    """
    return _analyze_logic(url)

def _analyze_logic(url: str):
    print(f"🚀 [Cloud] Starting analysis for: {url}")
    
    from io import StringIO
    import contextlib

    @contextlib.contextmanager
    def capture_stdout():
        new_out = StringIO()
        old_out = sys.stdout
        try:
            sys.stdout = new_out
            yield new_out
        finally:
            sys.stdout = old_out

    # --- Step 1: Scrape ---
    print(f"--- Scraping {url} ---")
    scrape_data = None
    with capture_stdout() as buffer:
        try:
            from tools.scrape_agency import scrape_agency as run_scrape
            run_scrape(url)
        except Exception as e:
            print(f"Scrape Error: {e}")
            return {"success": False, "error": str(e)}
            
    try:
        scrape_output = buffer.getvalue()
        # Find the last valid JSON line or try parsing the whole thing if it's clean
        # scrape_agency prints JSON at the end.
        scrape_json = json.loads(scrape_output)
        if not scrape_json.get("success"):
            return scrape_json
        scrape_data = scrape_json
    except json.JSONDecodeError:
        return {"success": False, "error": f"Invalid Scrape JSON: {scrape_output}"}

    # --- Step 2: Extract ---
    print(f"--- Extracting Insights ---")
    extract_data = None
    with capture_stdout() as buffer:
        try:
            from tools.extract_insights import extract_insights as run_extract
            run_extract(scrape_data["markdown"], url)
        except Exception as e:
             return {"success": False, "error": str(e)}

    try:
        extract_output = buffer.getvalue()
        extract_json = json.loads(extract_output)
        if "error" in extract_json:
             return extract_json
        extract_data = extract_json 
    except json.JSONDecodeError:
         return {"success": False, "error": f"Invalid Extract JSON: {extract_output}"}

    # --- Step 3: Store ---
    print(f"--- Storing Data ---")
    with capture_stdout() as buffer:
        try:
            from tools.store_data import store_data as run_store
            run_store(extract_data) 
        except Exception as e:
            return {"success": False, "error": str(e)}

    try:
        store_output = buffer.getvalue()
        store_json = json.loads(store_output)
        return store_json
    except json.JSONDecodeError:
        return {"success": False, "error": f"Invalid Store JSON: {store_output}"}


@app.function(
    image=image,
    secrets=secrets,
    schedule=modal.Cron("0 0 * * *") # Run daily at midnight UTC
)
def scheduled_reanalysis():
    print("⏰ Starting scheduled re-analysis of stale agencies...")
    from supabase import create_client
    from datetime import datetime, timedelta

    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    supabase = create_client(url, key)

    # Find agencies not analyzed in the last 30 days
    cutoff_date = (datetime.utcnow() - timedelta(days=30)).isoformat()
    
    # Note: 'last_analyzed' is a text field in our schema, so string comparison should work for ISO dates
    # But ideally it should be timestamptz.
    response = supabase.table("agencies").select("website").lt("last_analyzed", cutoff_date).execute()
    
    agencies_to_refresh = response.data
    print(f"Found {len(agencies_to_refresh)} agencies to update.")

    for agency in agencies_to_refresh:
        website = agency.get("website")
        if website:
             print(f"Queueing update for: {website}")
             # Call remote function to process in parallel or sequence
             analyze_agency.remote(website)

@app.local_entrypoint()
def main(url: str = "https://www.hugeinc.com"):
    print(f"Triggering remote analysis for {url}...")
    result = analyze_agency.remote(url)
    print(f"Result: {result}")
