
import os
import json
import urllib.request

def load_env_manual(filepath):
    """
    Manually parse .env file to avoid external dependencies like python-dotenv
    in this early initialization phase.
    """
    env_vars = {}
    try:
        with open(filepath, 'r') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                if '=' in line:
                    key, value = line.split('=', 1)
                    value = value.strip('"').strip("'")
                    env_vars[key] = value
    except Exception as e:
        print(f"Error reading .env: {e}")
    return env_vars

def check_firecrawl():
    env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
    config = load_env_manual(env_path)
    
    api_key = config.get("FIRECRAWL_API_KEY")
    
    if not api_key:
        print("❌ FAILED: Missing FIRECRAWL_API_KEY in .env")
        return

    print("Checking Firecrawl Connection...")
    
    # Firecrawl /v0/scrape endpoint usually requires a POST with url
    # We can try a lightweight check or just scrape a tiny page. 
    # Or checking /v0/credit-usage if it exists, but typically scraping example.com is a good test.
    
    url = "https://api.firecrawl.dev/v0/scrape"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    data = json.dumps({
        "url": "https://example.com"
    }).encode("utf-8")

    import ssl
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    try:
        req = urllib.request.Request(url, data=data, headers=headers, method="POST")
        with urllib.request.urlopen(req, context=ctx) as response:
            status = response.getcode()
            response_data = json.loads(response.read().decode())
            
            if response_data.get('success') or status == 200:
                print(f"✅ SUCCESS: Firecrawl is active! (Status: {status})")
            else:
                print(f"❌ FAILED: API responded but success is false. {response_data}")
                
    except urllib.error.HTTPError as e:
        print(f"❌ FAILED: HTTP Error {e.code} - {e.reason}")
        try:
            error_body = e.read().decode()
            print(f"Response: {error_body}")
        except:
            pass
    except Exception as e:
         print(f"❌ FAILED: Connection Error. {e}")

if __name__ == "__main__":
    check_firecrawl()
