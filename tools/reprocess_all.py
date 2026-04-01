
import os
import sys
import json
import subprocess
from dotenv import load_dotenv
from supabase import create_client, Client

# Add tools directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Load .env
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

def run_orchestrator(agency_name, url):
    print(f"\\n--- Processing: {agency_name} ({url}) ---")
    try:
        # Construct command: python tools/orchestrator.py --url <url>
        cmd = [sys.executable, "tools/orchestrator.py", "--url", url]
        
        # Run process
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode == 0:
            print(f"✅ Success for {agency_name}")
            # print(result.stdout) # Optional: print stdout
        else:
            print(f"❌ Failed for {agency_name}")
            print(f"Error: {result.stderr}")
            
    except Exception as e:
        print(f"❌ Exception for {agency_name}: {str(e)}")

def main():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
        return

    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    print("Fetching agencies from Supabase...")
    try:
        # Fetch all agencies, order by name
        response = supabase.table("agencies").select("name, website").order("name").execute()
        agencies = response.data
        
        print(f"Found {len(agencies)} agencies. Starting batch processing...")
        
        for agency in agencies:
            name = agency.get("name")
            website = agency.get("website")
            
            if website:
                run_orchestrator(name, website)
            else:
                print(f"Skipping {name} (No website)")
                
        print("\\n✅ Batch processing complete.")
        
    except Exception as e:
        print(f"Error fetching agencies: {str(e)}")

if __name__ == "__main__":
    main()
