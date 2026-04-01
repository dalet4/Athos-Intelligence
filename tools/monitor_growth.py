import argparse
import json
import sys
import os
from datetime import datetime
from typing import Optional, List
from openai import OpenAI
from dotenv import load_dotenv
from cost_manager import CostManager

# Load .env
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# Try imports for extensibility
try:
    from duckduckgo_search import DDGS
    HAS_DDGS = True
except ImportError:
    HAS_DDGS = False

class GrowthMonitor:
    def __init__(self):
        self.ddgs = DDGS() if HAS_DDGS else None
        
        api_key = OPENROUTER_API_KEY or OPENAI_API_KEY
        base_url = "https://openrouter.ai/api/v1" if OPENROUTER_API_KEY else None
        self.model = "openai/gpt-4o-mini" # Use a mini model for cheaper classification
        
        if api_key:
            self.client = OpenAI(base_url=base_url, api_key=api_key)
        else:
            self.client = None

    def fetch_signals(self, agency_name: str):
        """
        Orchestrates the signal gathering. 
        """
        signals = {
            "news": [],
            "social_mentions": [],
            "timestamp": datetime.now().isoformat(),
            "sources_used": []
        }
        
        # 1. News Search (Prioritize DDGS News)
        if self.ddgs:
            try:
                signals["news"] = self.scan_news(agency_name)
                signals["sources_used"].append("duckduckgo_news")
            except Exception as e:
                sys.stderr.write(f"News scan failed: {e}\n")

        # 2. Social Search (LinkedIn via Google/DDG)
        if self.ddgs:
            try:
                signals["social_mentions"] = self.scan_social(agency_name)
                signals["sources_used"].append("duckduckgo_text")
            except Exception as e:
                sys.stderr.write(f"Social scan failed: {e}\n")
        
        # Extensions for Apify/Serper would go here
        # if os.getenv("SERPER_API_KEY"): ...
            
        return signals

    def scan_news(self, agency_name: str):
        """Searches for recent news using DDGS News."""
        # News search is often more reliable for "wins"
        query = f'"{agency_name}" (award OR "new client" OR partnership OR "press release")'
        print(f"DEBUG: Searching News: {query}", file=sys.stderr)
        # DDGS().news() returns list of dicts
        results = []
        for r in self.ddgs.news(query, max_results=5):
            results.append({
                "title": r.get('title'),
                "url": r.get('url'),
                "date": r.get('date'),
                "source": r.get('source')
            })
        return results

    def scan_social(self, agency_name: str):
        """Searches for indexed LinkedIn posts."""
        # Use text search for site:linkedin.com
        query = f'site:linkedin.com/company/ "{agency_name}" ("thrilled to announce" OR "welcome" OR "partnership")'
        print(f"DEBUG: Searching Social: {query}", file=sys.stderr)
        results = []
        for r in self.ddgs.text(query, max_results=5):
            results.append({
                "title": r.get('title'),
                "url": r.get('href'),
                "description": r.get('body')
            })
    def analyze_signals(self, signals: dict, agency_name: str, run_id: Optional[str] = None):
        """
        Uses LLM to categorize raw signals into structured growth events.
        """
        if not self.client:
            return signals

        # Flatten signals for context
        news_context = "\n".join([f"- {n['title']} ({n['url']})" for n in signals.get("news", []) or []])
        social_context = "\n".join([f"- {s['title']}: {s.get('description', '')[:200]}" for s in signals.get("social_mentions", []) or []])
        
        prompt = f"""
        Analyze these search results for the agency "{agency_name}".
        Categorize each entry into one of: "Won Work", "Recruitment", "Award", "Partnership", or "General News".
        Look specifically for "recruitment" or "hiring" signals and "won work" or "new client" wins.
        
        News:
        {news_context}
        
        Social:
        {social_context}
        
        Return a JSON object with a single key 'classified_signals' which is a list of objects:
        {{ "title": "...", "url": "...", "type": "...", "summary": "brief summary" }}
        """

        try:
            completion = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a growth signal analyst. Return JSON ONLY."},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"}
            )
            
            raw_response = completion.choices[0].message.content
            classified = json.loads(raw_response)
            signals["classified_signals"] = classified.get("classified_signals", [])
            
            # Record Cost
            if run_id:
                usage = completion.usage
                cm = CostManager()
                cm.record_usage(
                    run_id=run_id,
                    model=self.model,
                    prompt_tokens=usage.prompt_tokens,
                    completion_tokens=usage.completion_tokens
                )
                
        except Exception as e:
            sys.stderr.write(f"Signal analysis failed: {e}\n")
            
        return signals

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Monitor Agency Growth Signals")
    parser.add_argument("--agency", required=True, help="Agency Name")
    parser.add_argument("--run-id", help="Run ID for cost tracking")
    args = parser.parse_args()
    
    if not HAS_DDGS:
        print(json.dumps({"error": "duckduckgo-search not installed. pip install duckduckgo-search"}))
        sys.exit(1)

    monitor = GrowthMonitor()
    results = monitor.fetch_signals(args.agency)
    
    # New analysis step
    results = monitor.analyze_signals(results, args.agency, run_id=args.run_id)
    
    print(json.dumps(results, indent=2))
