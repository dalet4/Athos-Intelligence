import os
import sys
import argparse
import json
from dotenv import load_dotenv
from supabase import create_client, Client

# Add tools directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from enrich_hunter import enrich_with_hunter

# Load .env
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
HUNTER_API_KEY = os.getenv("HUNTER_API_KEY")

def store_data(data: dict):
    if not SUPABASE_URL or not SUPABASE_KEY:
        print(json.dumps({"error": "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"}))
        return

    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        
        # --- ENRICHMENT LAYER (Hunter.io) ---
        directors = data.get("directors", [])
        if HUNTER_API_KEY and data.get("website"):
            try:
                sys.stderr.write(f"Enriching {data['website']} with Hunter.io...\n")
                hunter_directors = enrich_with_hunter(data["website"], HUNTER_API_KEY)
                
                # Merge Logic:
                # 1. Create lookup of existing directors by name (normalized)
                existing_map = {d["name"].lower(): d for d in directors}
                
                for hd in hunter_directors:
                    h_name = hd["name"].lower()
                    if h_name in existing_map:
                        # Update existing with Hunter data (Email/LinkedIn are high value)
                        target = existing_map[h_name]
                        if not target.get("email"): target["email"] = hd.get("email")
                        if not target.get("linkedin_url"): target["linkedin_url"] = hd.get("linkedin_url")
                        if not target.get("role"): target["role"] = hd.get("role")
                    else:
                        # Add new director found by Hunter
                        directors.append(hd)
                
                sys.stderr.write(f"Enrichment Complete. Total Directors: {len(directors)}\n")
            except Exception as e:
                sys.stderr.write(f"Hunter Enrichment Failed: {str(e)}\n")

        # Prepare payload for upsert
        payload = {
            "name": data.get("name"),
            "website": data.get("website"),
            "description": data.get("description"),
            "specializations": data.get("services", []) or data.get("specializations", []),
            "platforms": data.get("platforms", []),
            "revenue_estimate": data.get("revenue_estimate"),
            "partners": data.get("partners", []),
            "clients": data.get("clients", []),
            "case_studies": data.get("case_studies", []),
            "directors": directors, # Enriched list
            "awards": data.get("awards", []),
            "partner_page_url": data.get("partner_page_url"),
            "last_analyzed": data.get("last_analyzed") 
        }

        # Upsert
        response = supabase.table("agencies").upsert(payload, on_conflict="website").execute()
        
        print(json.dumps({"success": True, "data": str(response)}))

    except Exception as e:
        print(json.dumps({"success": False, "error": f"Supabase Error: {str(e)}"}))

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Store agency data in Supabase.")
    # Read from stdin
    content = sys.stdin.read()
    try:
        raw_input = json.loads(content)
        # Unwrap "data" if it exists
        if raw_input.get("success") and "data" in raw_input:
            data = raw_input["data"]
        else:
            data = raw_input
            
        store_data(data)
    except json.JSONDecodeError:
        print(json.dumps({"error": "Invalid JSON input"}))
