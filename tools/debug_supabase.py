
import os
import json
from dotenv import load_dotenv
from supabase import create_client, Client

# Load .env
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

def debug_supabase():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("Missing Credentials")
        return

    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        
        # Try to select from the table directly (limit 1)
        print("--- Attempting select from 'agencies' ---")
        try:
            res = supabase.table("agencies").select("*").limit(1).execute()
            print(f"Select Success: {res}")
        except Exception as e:
            print(f"Select Failed: {e}")

        # Try to list all tables in public schema via RPC or just printing error details
        # Supabase-py doesn't give direct SQL access easily without RPC.
        # But we can try to guess common issues.
        
    except Exception as e:
        print(f"Connection Error: {e}")

if __name__ == "__main__":
    debug_supabase()
