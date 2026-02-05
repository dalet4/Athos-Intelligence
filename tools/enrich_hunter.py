
import os
import requests
import json
from urllib.parse import urlparse

def get_domain_from_url(url):
    parsed = urlparse(url)
    domain = parsed.netloc or parsed.path
    if domain.startswith('www.'):
        domain = domain[4:]
    return domain

def enrich_with_hunter(url, api_key):
    """
    Queries Hunter.io for domain search to find emails.
    """
    domain = get_domain_from_url(url)
    api_url = f"https://api.hunter.io/v2/domain-search?domain={domain}&api_key={api_key}&limit=10"
    
    try:
        response = requests.get(api_url, timeout=10)
        if response.status_code == 200:
            data = response.json()
            emails = data.get('data', {}).get('emails', [])
            
            # Convert to our Director format
            directors = []
            for e in emails:
                if e.get('first_name') and e.get('last_name'):
                    name = f"{e['first_name']} {e['last_name']}"
                    role = e.get('position') or "Employee"
                    email = e.get('value')
                    directors.append({
                        "name": name, 
                        "role": role, 
                        "email": email,
                        "linkedin_url": e.get('linkedin') 
                    })
            return directors
        return []
    except Exception as e:
        return []

if __name__ == "__main__":
    # Test
    key = os.getenv("HUNTER_API_KEY")
    if key:
        print(json.dumps(enrich_with_hunter("https://velstar.co.uk", key)))
    else:
        print("Set HUNTER_API_KEY to test.")
