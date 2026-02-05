
import os
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
                    # Remove quotes if present
                    value = value.strip('"').strip("'")
                    env_vars[key] = value
    except Exception as e:
        print(f"Error reading .env: {e}")
    return env_vars

def check_supabase():
    # Load env from parent directory
    env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
    print(f"Loading .env from: {env_path}")
    
    config = load_env_manual(env_path)
    
    url_base = config.get("SUPABASE_URL")
    key = config.get("SUPABASE_ANON_KEY")

    print(f"Checking Connection to: {url_base}...")
    
    if not url_base or not key:
        print("❌ FAILED: Missing Credentials in .env")
        return

    # Using /rest/v1/ with a LIMIT 0 to just check auth on a potential table, 
    # OR just checking root. Root gives 200 usually.
    # But to test KEY we need an authorized endpoint.
    # Let's try to query 'agencies' (which might not exist, but we see if we get 404 or 401)
    
    target_url = f"{url_base}/rest/v1/" 
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}"
    }

    import ssl
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    def try_connect(token, name):
        if not token:
            print(f"⚠️  Skipping {name}: Key not found.")
            return False
            
        print(f"Testing {name}...")
        headers = {
            "apikey": token,
            "Authorization": f"Bearer {token}"
        }
        try:
            req = urllib.request.Request(target_url, headers=headers)
            with urllib.request.urlopen(req, context=ctx) as response:
                status = response.getcode()
                print(f"✅ SUCCESS: Connected with {name}! (Status: {status})")
                return True
        except urllib.error.HTTPError as e:
            if e.code == 401:
                print(f"❌ FAILED: {name} Authentication Failed (401).")
            else:
                print(f"✅ SUCCESS-ISH: {name} Connection made! Status: {e.code}")
                return True
        except Exception as e:
            print(f"❌ FAILED: {name} Error: {e}")
        return False

    # Try Anon
    if try_connect(key, "Anon Key"):
        print("Credentials are valid.")
    else:
        # Try Service Role
        service_key = config.get("SUPABASE_SERVICE_ROLE_KEY")
        if try_connect(service_key, "Service Role Key"):
            print("Credentials are valid (using Service Role).")

if __name__ == "__main__":
    check_supabase()
