
import os
import json
import time
import sys
from dotenv import load_dotenv
from supabase import create_client, Client

# Import our tools
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from scrape_agency import scrape_agency_crawler, scrape_url, find_subpages, extract_with_openai
# We need to monkeytype hack or refactor scrape_agency to return object instead of print
# Actually, let's just use subprocess for safety, or refactor scrape_agency to be importable.
# I'll modify scrape_agency to have a helper that returns the dict.

# Load .env
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

def get_all_agencies():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("Error: Missing Supabase Credentials")
        return []
    
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    # Select all websites
    response = supabase.table("agencies").select("website").execute()
    # Access data using the .data attribute on the response object
    return [row['website'] for row in response.data if row.get('website')]

def run_refresh():
    print("--- 🔄 Starting Batch Refresh of All Agencies ---")
    websites = get_all_agencies()
    print(f"Found {len(websites)} agencies in database.")
    
    for i, url in enumerate(websites):
        print(f"\n[{i+1}/{len(websites)}] Processing: {url}")
        
        # We will use subprocess to run the tool exactly as the CLI does, 
        # to ensure environment and piping works identical to 'manual' run.
        # This is robust.
        cmd = f"python3 tools/scrape_agency.py --url {url} > temp_batch.json"
        exit_code = os.system(cmd)
        
        if exit_code == 0:
            # Check if temp_batch.json has content
            try:
                with open("temp_batch.json", "r") as f:
                    content = f.read()
                    if content.strip():
                        # Run store_data
                        os.system(f"cat temp_batch.json | python3 tools/store_data.py")
                        print(f"✅ Updated {url}")
                    else:
                        print(f"⚠️  No output for {url}")
            except Exception as e:
                print(f"❌ Error reading output: {e}")
        else:
            print(f"❌ Scraper failed for {url}")
            
        time.sleep(2) # Politeness delay
        
    print("\n--- ✨ Batch Refresh Complete ---")
    if os.path.exists("temp_batch.json"):
        os.remove("temp_batch.json")

if __name__ == "__main__":
    run_refresh()
