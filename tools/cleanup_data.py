import os
import sys
import json
from dotenv import load_dotenv
from supabase import create_client

# Explicitly load .env from the project root
load_dotenv("/Users/daletaylor/Desktop/Athos-Intelligence/.env")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Missing credentials")
    sys.exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def normalize_url(url: str) -> str:
    if not url: return ""
    normalized = url.lower()
    for prefix in ["https://", "http://", "www."]:
        if normalized.startswith(prefix):
            normalized = normalized[len(prefix):]
    return normalized.rstrip("/")

def is_hr_contact(title: str, role: str) -> bool:
    title_lower = (title or "").lower()
    role_lower = (role or "").lower()
    hr_keywords = ["hr", "human resources", "people", "talent", "recruitment", "recruiter", "hiring"]
    return any(kw in title_lower or kw in role_lower for kw in hr_keywords)

def cleanup():
    try:
        print("--- Duplicate Agency Cleanup ---")
        response = supabase.table("agencies").select("*").execute()
        agencies = response.data
        
        # Group by normalized URL and Name
        url_map = {}
        for a in agencies:
            norm_url = normalize_url(a.get("website"))
            name = a.get("name", "").lower()
            key = norm_url if norm_url else f"name:{name}"
            
            if key not in url_map:
                url_map[key] = []
            url_map[key].append(a)
            
        for key, dup_list in url_map.items():
            if len(dup_list) > 1:
                print(f"Found {len(dup_list)} duplicates for '{key}'")
                # Keep the one with most data (heuristic: more non-null fields or specific important fields)
                # For now, keep the one with a parent_company if others don't, or just the first one.
                primary = sorted(dup_list, key=lambda x: (x.get('parent_company') is not None, len(str(x))), reverse=True)[0]
                to_delete = [a for a in dup_list if a['id'] != primary['id']]
                
                for a in to_delete:
                    print(f"  Deleting duplicate ID: {a['id']} (Keeping {primary['id']})")
                    supabase.table("agencies").delete().eq("id", a['id']).execute()

        print("\n--- HR Contact Cleanup ---")
        # Fetch updated list after deletions
        response = supabase.table("agencies").select("id, name, partner_managers, directors").execute()
        for agency in response.data:
            pms = agency.get('partner_managers') or []
            dirs = agency.get('directors') or []
            
            new_pms = []
            moved_to_dirs = 0
            
            changed = False
            for pm in pms:
                if is_hr_contact(pm.get('title'), pm.get('role')):
                    # Move to directors instead of deleting? Usually HR isn't a "director" in our context 
                    # but maybe safer than deleting. Actually, user said it "isn't right". 
                    # Let's move them to directors if they are senior, or just remove if they are "HR Business Partner".
                    print(f"  Removing HR contact '{pm.get('name')}' from {agency['name']} partner_managers")
                    # If it's a "Partner" but "HR", it definitely doesn't belong in partner_managers
                    changed = True
                    # Optional: append to directors if not there
                    if pm.get('name').lower() not in [d.get('name', '').lower() for d in dirs]:
                        dirs.append(pm)
                        moved_to_dirs += 1
                else:
                    new_pms.append(pm)
            
            if changed:
                supabase.table("agencies").update({
                    "partner_managers": new_pms,
                    "directors": dirs
                }).eq("id", agency['id']).execute()
                print(f"  Updated {agency['name']}: {moved_to_dirs} contacts moved to directors.")

        print("\nCleanup complete.")

    except Exception as e:
        print(f"Cleanup Error: {e}")

if __name__ == "__main__":
    cleanup()
