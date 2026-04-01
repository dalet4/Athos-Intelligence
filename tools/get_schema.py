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

# Try querying information_schema.columns directly
try:
    # Use a dummy RPC that might exist or just a select if allowed
    # Note: select from information_schema might not be allowed via PostgREST unless there is a view.
    # We can try to query 'agencies' which we know is likely there.
    # Let's try to get one row and check the keys.
    query = supabase.table("agencies").select("*").limit(1).execute()
    if query.data:
        print(json.dumps(list(query.data[0].keys()), indent=2))
    else:
        print("No rows found in agencies table.")
except Exception as e:
    print(f"Error: {e}")
