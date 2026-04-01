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
# We just want to see if we can query the new columns without error
try:
    response = supabase.table("agencies").select("id, name, is_group_member, partner_managers").limit(1).execute()
    print(json.dumps({"success": True, "columns_found": True}))
except Exception as e:
    print(json.dumps({"success": False, "error": str(e)}))
