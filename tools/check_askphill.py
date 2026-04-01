import os
import sys
import json
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Missing credentials")
    sys.exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
response = supabase.table("agencies").select("id, name, website, directors, partner_managers").ilike("name", "%Ask Phill%").execute()

for row in response.data:
    print(json.dumps(row, indent=2))
