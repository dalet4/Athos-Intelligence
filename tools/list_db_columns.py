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
try:
    # Query the information_schema via RPC if possible, or just a dummy select
    # Since we don't have an RPC for info schema, let's just try to fetch one row and see keys
    response = supabase.table("agencies").select("*").limit(1).execute()
    if response.data:
        print(json.dumps(list(response.data[0].keys()), indent=2))
    else:
        print("No data found in agencies table to check columns.")
except Exception as e:
    print(str(e))
