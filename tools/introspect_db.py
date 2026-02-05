import os
import requests
import json
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")

def get_tables():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("Missing credentials")
        return

    # Using the PostgREST API exposed by Supabase to list tables
    # This endpoint returns the OpenAPI definition which contains the schema
    url = f"{SUPABASE_URL}/rest/v1/"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}"
    }

    try:
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            definitions = response.json().get("definitions", {})
            print(f"Found {len(definitions)} tables/views:")
            for table_name, details in definitions.items():
                print(f"\nTable: {table_name}")
                properties = details.get("properties", {})
                for col_name, col_props in properties.items():
                    col_type = col_props.get("type", "unknown")
                    col_fmt = col_props.get("format", "")
                    print(f"  - {col_name}: {col_type} {col_fmt}")
        else:
            print(f"Failed to fetch schema. Status: {response.status_code}")
            print(response.text)
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    get_tables()
