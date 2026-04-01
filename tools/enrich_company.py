import os
import sys
import json
import argparse
import requests
from dotenv import load_dotenv

# Load .env
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))

BUILTWITH_API_KEY = os.getenv("BUILTWITH_API_KEY")

def get_tech_stack(domain: str):
    """
    Fetches technology stack via BuiltWith API.
    """
    if not BUILTWITH_API_KEY:
        return []
    
    url = f"https://api.builtwith.com/v2/api.json?key={BUILTWITH_API_KEY}&LOOKUP={domain}"
    try:
        response = requests.get(url)
        if response.status_code == 200:
            data = response.json()
            # Basic parsing of 'Paths' and 'Technologies'
            techs = []
            for path in data.get("Paths", []):
                for tech in path.get("Technologies", []):
                    techs.append(tech.get("Name"))
            return list(set(techs)) # Deduplicate
        return []
    except Exception:
        return []

def main():
    parser = argparse.ArgumentParser(description="Enrich agency data with BuiltWith and other sources.")
    parser.add_argument("--domain", required=True, help="Domain to lookup")
    args = parser.parse_args()
    
    tech_stack = get_tech_stack(args.domain)
    
    # Placeholder for headcount/locations which will be refined via AI/Hunter later
    result = {
        "domain": args.domain,
        "tech_stack": tech_stack,
        "success": True
    }
    
    print(json.dumps(result))

if __name__ == "__main__":
    main()
