
import os
import json
import urllib.request

def load_env_manual(filepath):
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

def check_openrouter():
    env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
    config = load_env_manual(env_path)
    
    api_key = config.get("OPENROUTER_API_KEY")
    
    if not api_key:
        print("❌ FAILED: Missing OPENROUTER_API_KEY in .env")
        return

    print("Checking OpenRouter Connection...")
    
    # OpenRouter Models Endpoint
    url = "https://openrouter.ai/api/v1/models"
    headers = {
        "Authorization": f"Bearer {api_key}",
    }

    import ssl
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, context=ctx) as response:
            status = response.getcode()
            response_data = json.loads(response.read().decode())
            
            if status == 200:
                print(f"✅ SUCCESS: OpenRouter is active! (Status: {status})")
                print(f"   Available models: {len(response_data.get('data', []))}")
            else:
                print(f"❌ FAILED: API responded with status {status}")
                
    except urllib.error.HTTPError as e:
        print(f"❌ FAILED: HTTP Error {e.code} - {e.reason}")
    except Exception as e:
         print(f"❌ FAILED: Connection Error. {e}")

if __name__ == "__main__":
    check_openrouter()
