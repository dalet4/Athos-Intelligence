import os
import sys
from dotenv import load_dotenv
from supabase import create_client

print("--- DEBUG: Starting verbose_check.py ---")
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.env')
print(f"DEBUG: Looking for .env at: {os.path.abspath(env_path)}")
load_dotenv(env_path)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

print(f"DEBUG: SUPABASE_URL: {SUPABASE_URL[:20]}...")
print(f"DEBUG: SUPABASE_KEY: {SUPABASE_KEY[:10]}...")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("DEBUG: ERROR: Missing credentials")
    sys.exit(1)

print("DEBUG: Creating Supabase client...")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
print("DEBUG: Client created. Executing query...")

try:
    response = supabase.table("agencies").select("name").limit(1).execute()
    print(f"DEBUG: Query executed. Status: OK")
    print(f"RESULT: Data found: {response.data}")
except Exception as e:
    print(f"DEBUG: ERROR: {e}")
