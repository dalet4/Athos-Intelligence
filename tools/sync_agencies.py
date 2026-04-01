import os
import sys
import argparse
import json
import logging
from datetime import datetime, timedelta
from dotenv import load_dotenv
from supabase import create_client, Client
import subprocess

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Load .env
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

def get_stale_agencies(days: int):
    """
    Fetches agencies focus on those that haven't been analyzed in X days.
    """
    if not SUPABASE_URL or not SUPABASE_KEY:
        logging.error("Missing Supabase credentials.")
        return []

    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    # Calculate cutoff
    cutoff_date = (datetime.now() - timedelta(days=days)).isoformat()
    
    logging.info(f"Fetching agencies not analyzed since {cutoff_date}...")
    
    try:
        # We fetch agencies where last_analyzed is older than cutoff OR null
        # Supabase syntax for OR is complex in library, easier to do two checks or fetch all and filter
        # Let's fetch all and filter in Python for simplicity and robustness
        response = supabase.table("agencies").select("id, name, website, last_analyzed").execute()
        
        all_agencies = response.data
        stale = []
        
        for agency in all_agencies:
            last = agency.get("last_analyzed")
            if not last:
                stale.append(agency)
            else:
                try:
                    # Handle potential Z or + offset
                    last_dt = datetime.fromisoformat(last.replace('Z', '+00:00'))
                    if last_dt < datetime.fromisoformat(cutoff_date + '+00:00'):
                        stale.append(agency)
                except Exception as e:
                    logging.warning(f"Failed to parse date for {agency['name']}: {e}")
                    stale.append(agency)
                    
        return stale
    except Exception as e:
        logging.error(f"Failed to fetch agencies: {e}")
        return []

def sync_agency(url: str):
    """
    Runs the orchestrator for a specific URL.
    """
    orchestrator_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "orchestrator.py")
    logging.info(f"🔄 Syncing URL: {url}")
    
    try:
        # We use subprocess to run the orchestrator as a separate tool
        result = subprocess.run(
            [sys.executable, orchestrator_path, "--url", url],
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            logging.info(f"✅ Successfully synced: {url}")
            return True
        else:
            logging.error(f"❌ Failed to sync: {url}")
            logging.error(f"Error output: {result.stderr}")
            return False
    except Exception as e:
        logging.error(f"Exception syncing {url}: {e}")
        return False

def main():
    parser = argparse.ArgumentParser(description="Automate agency data synchronization.")
    parser.add_argument("--days", type=int, default=7, help="Sync agencies not analyzed in this many days.")
    parser.add_argument("--limit", type=int, default=10, help="Maximum number of agencies to sync in one run.")
    parser.add_argument("--url", type=str, help="Sync a specific URL only.")
    parser.add_argument("--dry-run", action="store_true", help="List agencies to sync without actually running orchestration.")

    args = parser.parse_args()

    if args.url:
        if args.dry_run:
            logging.info(f"[Dry Run] Would sync: {args.url}")
        else:
            sync_agency(args.url)
        return

    stale_agencies = get_stale_agencies(args.days)
    
    if not stale_agencies:
        logging.info("No stale agencies found. Everything is up to date!")
        return

    logging.info(f"Found {len(stale_agencies)} stale agencies.")
    
    count = 0
    for agency in stale_agencies:
        if count >= args.limit:
            logging.info(f"Reached limit of {args.limit} agencies. Stopping.")
            break
            
        url = agency.get("website")
        if not url:
            logging.warning(f"Skipping {agency.get('name')} - No website URL.")
            continue
            
        if args.dry_run:
            logging.info(f"[Dry Run] Would sync: {agency.get('name')} ({url})")
        else:
            sync_agency(url)
            
        count += 1

    logging.info(f"Sync complete. Total processed: {count}")

if __name__ == "__main__":
    main()
