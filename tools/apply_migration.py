import os
import sys
import requests
from dotenv import load_dotenv

load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Missing DB credentials")
    sys.exit(1)

# Read migrations
migrations = [
    "Display/supabase/migrations/20260302093857_add_growth_columns.sql",
    "Display/supabase/migrations/20260302094129_add_competitor_partnerships_column.sql",
    "Display/supabase/migrations/20260302103500_add_lead_score_columns.sql",
    "Display/supabase/migrations/20260302110000_add_parent_company.sql",
    "Display/supabase/migrations/20260307114300_add_group_membership.sql"
]

sql_script = ""
for m in migrations:
    if os.path.exists(m):
        with open(m, 'r') as f:
            sql_script += f.read() + "\n"

print("To apply this migration, please run the following SQL script in your Supabase SQL Editor:")
print("--------------------------------------------------")
print(sql_script)
print("--------------------------------------------------")
print("I cannot apply it directly via the REST API as the `rpc` function is not guaranteed to exist for raw sql.")
