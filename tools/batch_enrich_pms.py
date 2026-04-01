
import os
import sys
import json
import logging
from dotenv import load_dotenv
from supabase import create_client

# Load .env
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def batch_enrich():
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not key:
        logging.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
        return

    supabase = create_client(url, key)
    
    # Identify agencies with empty partner_managers
    # Since Supabase filters on JSONB can be tricky, we'll fetch then filter locally for simplicity
    res = supabase.table("agencies").select("id, name, website, partner_managers").execute()
    
    agencies_to_enrich = []
    for agency in res.data:
        pms = agency.get("partner_managers")
        if not pms or len(pms) == 0:
            agencies_to_enrich.append(agency)
            
    logging.info(f"Found {len(agencies_to_enrich)} agencies missing partner manager data.")
    
    # Import orchestrate from orchestrator.py
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
    from orchestrator import orchestrate
    
    for agency in agencies_to_enrich:
        name = agency.get("name")
        website = agency.get("website")
        
        if not website:
            logging.warning(f"Skipping {name} - No website URL")
            continue
            
        logging.info(f"--- Enriching {name} ({website}) ---")
        try:
            orchestrate(website)
            logging.info(f"Successfully enriched {name}")
        except Exception as e:
            logging.error(f"Failed to enrich {name}: {e}")

if __name__ == "__main__":
    batch_enrich()
