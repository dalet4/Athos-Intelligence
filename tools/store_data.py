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

def normalize_url(url: str) -> str:
    """Standardizes URL for duplicate checking: no protocol, no www, no trailing slash."""
    if not url:
        return ""
    normalized = url.lower()
    for prefix in ["https://", "http://", "www."]:
        if normalized.startswith(prefix):
            normalized = normalized[len(prefix):]
    return normalized.rstrip("/")

def canonical_url(url: str) -> str:
    """Returns a canonical stored URL: always https://, no www, lowercase, no trailing slash.
    Ensures upsert conflict on 'website' reliably catches duplicates."""
    if not url:
        return ""
    u = url.strip().lower().rstrip("/")
    for prefix in ["https://", "http://"]:
        if u.startswith(prefix):
            u = u[len(prefix):]
            break
    if u.startswith("www."):
        u = u[4:]
    return f"https://{u}"

def is_hr_contact(title: str, role: str) -> bool:
    """Checks if a contact should be excluded from partnership roles due to being HR/Recruitment."""
    title_lower = (title or "").lower()
    role_lower = (role or "").lower()
    hr_keywords = ["hr", "human resources", "people", "talent", "recruitment", "recruiter", "hiring"]
    # Check if any HR keyword exists in title or role
    # but be careful not to exclude "Chief People Officer" if we ever want them, 
    # though usually we want "Strategy" or "Partner" roles.
    # If "partner" is present AND "hr" is present (e.g. HR Business Partner), it's HR.
    return any(kw in title_lower or kw in role_lower for kw in hr_keywords)

def store_data(data: dict):
    if not SUPABASE_URL or not SUPABASE_KEY:
        print(json.dumps({"error": "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"}))
        return

    # Normalize URL for storage consistency — canonical form prevents duplicate upserts
    if data.get("website"):
        data["website"] = canonical_url(data["website"])

    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        
        # --- ENRICHMENT LAYER (Hunter.io) ---
        directors = data.get("directors", [])
        partner_managers = data.get("partner_managers", [])
        if HUNTER_API_KEY and data.get("website"):
            try:
                sys.stderr.write(f"Enriching {data['website']} with Hunter.io...\n")
                hunter_people = enrich_with_hunter(data["website"], HUNTER_API_KEY)
                
                # Merge Logic:
                # 1. Create lookup of existing people by name (normalized)
                existing_dirs = {d["name"].lower(): d for d in directors}
                existing_pms = {p["name"].lower(): p for p in partner_managers}
                
                for hp in hunter_people:
                    h_name = hp["name"].lower()
                    h_title = hp.get("title", "")
                    h_role = hp.get("role", "")
                    
                    # Skip HR contacts entirely for both lists
                    if is_hr_contact(h_title, h_role):
                        continue

                    if h_name in existing_dirs:
                        target = existing_dirs[h_name]
                        if not target.get("email"): target["email"] = hp.get("email")
                        if not target.get("linkedin_url"): target["linkedin_url"] = hp.get("linkedin_url")
                        if not target.get("role") or target["role"] == "Employee": target["role"] = hp.get("role")
                    elif h_name in existing_pms:
                        target = existing_pms[h_name]
                        if not target.get("email"): target["email"] = hp.get("email")
                        if not target.get("linkedin_url"): target["linkedin_url"] = hp.get("linkedin_url")
                        if not target.get("role") or target["role"] == "Employee": target["role"] = hp.get("role")
                    else:
                        # Add new person found by Hunter
                        role_lower = (hp.get("role") or "").lower()
                        title_lower = (hp.get("title") or "").lower()
                        pm_keywords = [
                            "partnership", "partner", "alliance", "solutions architect", 
                            "ecommerce director", "growth lead", "specialist"
                        ]
                        if any(kw in role_lower or kw in title_lower for kw in pm_keywords):
                            partner_managers.append(hp)
                        else:
                            directors.append(hp)
                
                sys.stderr.write(f"Enrichment Complete. Directors: {len(directors)}, Partner Managers: {len(partner_managers)}\n")
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
            "partner_managers": partner_managers, # Enriched list
            "awards": data.get("awards", []),
            "partner_page_url": data.get("partner_page_url"),
            "growth_signals": data.get("growth_signals", []),
            "social_mentions": data.get("social_mentions", []),
            "competitor_partnerships": data.get("competitor_partnerships", []),
            "parent_company": data.get("parent_company"),
            "is_group_member": data.get("is_part_of_group", False),
            "tech_stack": data.get("tech_stack", []),
            "headcount": data.get("headcount"),
            "office_locations": data.get("office_locations", []),
            "sibling_agencies": data.get("sibling_agencies", []),
            "last_analyzed": data.get("last_analyzed") 
        }

        # Upsert
        response = supabase.table("agencies").upsert(payload, on_conflict="website").execute()
        
        if response.data and len(response.data) > 0:
            agency_id = response.data[0].get("id")
            print(json.dumps({"success": True, "id": agency_id, "data": response.data[0]}))
        else:
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
