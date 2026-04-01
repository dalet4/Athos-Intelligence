import os
import json
from dotenv import load_dotenv
from supabase import create_client, Client

# Load .env
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

def verify_data():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("Missing Supabase credentials")
        return

    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    # Query Vaimo
    response = supabase.table("agencies").select("name, directors, growth_signals, competitor_partnerships").ilike("website", "%vaimo.com%").limit(1).execute()
    
    if response.data:
        print(json.dumps(response.data[0], indent=2))
    else:
        print("Vaimo not found in database.")

if __name__ == "__main__":
    verify_data()
