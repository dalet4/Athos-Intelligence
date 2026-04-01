import os
import sys
import json
import argparse
from datetime import datetime
from typing import List, Optional, Dict
from dotenv import load_dotenv
from supabase import create_client, Client

# Load .env
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

def parse_revenue(rev_str: Optional[str]) -> int:
    """Extracts numeric value from revenue range string e.g. '$5M-$10M' -> 7.5M"""
    if not rev_str or rev_str.lower() == "unknown":
        return 0
    try:
        # Simple extraction: remove symbols, find 'm', handle ranges
        clean = rev_str.lower().replace('$', '').replace(' ', '')
        if 'm' in clean:
            # Handle range
            if '-' in clean:
                parts = clean.split('-')
                val1 = float(parts[0].replace('m', ''))
                val2 = float(parts[1].replace('m', ''))
                return int((val1 + val2) / 2 * 1_000_000)
            else:
                return int(float(clean.replace('m', '')) * 1_000_000)
        return 0
    except:
        return 0

def calculate_score(agency: Dict) -> Dict:
    """Calculates lead score (0-100) and returns breakdown."""
    score = 0
    breakdown = {
        "revenue": 0,
        "growth": 0,
        "alignment": 0,
        "competition": 0
    }

    # 1. Revenue (0-30 pts)
    rev_val = parse_revenue(agency.get("revenue_estimate"))
    if rev_val >= 50_000_000:
        breakdown["revenue"] = 30
    elif rev_val >= 10_000_000:
        breakdown["revenue"] = 20
    elif rev_val >= 1_000_000:
        breakdown["revenue"] = 10
    
    # 2. Growth (0-30 pts)
    # Check hiring count from growth_signals
    signals = agency.get("growth_signals", [])
    hiring_count = 0
    for s in signals:
        if isinstance(s, dict) and s.get("type") == "hiring":
            hiring_count += 1 # Or use a direct count if available
    
    # Fallback to extract_insights field if we add it or just use signals
    if hiring_count >= 5:
        breakdown["growth"] += 15
    elif hiring_count > 0:
        breakdown["growth"] += 5

    # Recent News (0-15 pts)
    news = agency.get("recent_news", [])
    if len(news) > 0:
        breakdown["growth"] += 15

    # 3. Strategic Alignment (0-20 pts)
    # Check for Partnership roles in directors
    directors = agency.get("directors", []) or []
    has_pm = False
    pm_keywords = ["partnership", "partner", "alliances"]
    for d in directors:
        role = d.get("role", "").lower()
        if any(kw in role for kw in pm_keywords):
            has_pm = True
            break
    
    if has_pm:
        breakdown["alignment"] = 20

    # 4. Competitor Presence (0-20 pts penalty/bonus)
    competitors = agency.get("competitor_partnerships", []) or []
    if len(competitors) == 0:
        breakdown["competition"] = 20
    elif len(competitors) <= 2:
        breakdown["competition"] = 10
    else:
        breakdown["competition"] = 0

    # 5. Holding Group / Scale (0-10 pts bonus)
    if agency.get("is_group_member"):
        # Bonus for being part of a group (stability/tier)
        breakdown["group_bonus"] = 10
    else:
        breakdown["group_bonus"] = 0

    total_score = sum(breakdown.values())
    # Cap score at 100 if necessary, or just return total
    return {
        "score": min(total_score, 100),
        "breakdown": breakdown
    }

def score_leads(agency_id: Optional[str] = None, dry_run: bool = False):
    if not SUPABASE_URL or not SUPABASE_KEY:
        print(json.dumps({"error": "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"}))
        return

    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        
        query = supabase.table("agencies").select("*")
        if agency_id:
            query = query.eq("id", agency_id)
        
        response = query.execute()
        agencies = response.data

        results = []
        for agency in agencies:
            scoring = calculate_score(agency)
            results.append({
                "id": agency["id"],
                "name": agency["name"],
                "score": scoring["score"],
                "breakdown": scoring["breakdown"]
            })

            if not dry_run:
                supabase.table("agencies").update({
                    "lead_score": scoring["score"],
                    "score_breakdown": scoring["breakdown"]
                }).eq("id", agency["id"]).execute()

        print(json.dumps({"success": True, "results": results}))

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Calculate lead scores for agencies.")
    parser.add_argument("--id", help="Specific agency ID to score")
    parser.add_argument("--dry-run", action="store_true", help="Calculate but don't update DB")
    args = parser.parse_args()
    
    score_leads(agency_id=args.id, dry_run=args.dry_run)
