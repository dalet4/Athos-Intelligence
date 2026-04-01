
import argparse
import json
import sys
import os
from datetime import datetime
from typing import Optional, List
from openai import OpenAI
from dotenv import load_dotenv

# Add cost manager
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from cost_manager import CostManager

# Load .env
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

try:
    from duckduckgo_search import DDGS
    HAS_DDGS = True
except ImportError:
    HAS_DDGS = False

class GroupEnricher:
    def __init__(self):
        self.ddgs = DDGS() if HAS_DDGS else None
        
        api_key = OPENROUTER_API_KEY or OPENAI_API_KEY
        base_url = "https://openrouter.ai/api/v1" if OPENROUTER_API_KEY else None
        self.model = "openai/gpt-4o-mini"
        
        if api_key:
            self.client = OpenAI(base_url=base_url, api_key=api_key)
        else:
            self.client = None

    def search_group_info(self, agency_name: str):
        """Searches for group and parent company information."""
        if not self.ddgs:
            return []

        queries = [
            f'{agency_name} parent company',
            f'{agency_name} acquired by',
            f'who owns {agency_name} agency',
            f'{agency_name} holding group'
        ]
        
        all_results = []
        for query in queries:
            try:
                results = self.ddgs.text(query, max_results=5)
                if results:
                    for r in results:
                        all_results.append({
                            "title": r.get('title'),
                            "url": r.get('href'),
                            "body": r.get('body'),
                            "query": query
                        })
                if len(all_results) >= 10:
                    break # Sufficient results
            except Exception as e:
                sys.stderr.write(f"Search failed for query '{query}': {e}\n")
                
        return all_results

    def analyze_group_membership(self, agency_name: str, search_results: List[dict], run_id: Optional[str] = None):
        """Analyzes search results to determine parent company and discover siblings."""
        if not self.client:
            return {"is_group_member": False, "parent_company": None}

        context = "\n".join([f"- {r['title']} (Source: {r['url']}): {r['body'][:300]}" for r in search_results])
        
        prompt = f"""
        Analyze if the agency "{agency_name}" is part of a larger group or holding company (e.g., WPP, MSQ, IDHL, BORN XDS, Stagwell, Dentsu, Publicis).
        Also, identify any OTHER agencies (siblings) that belong to the SAME group.
        
        Search Results:
        {context if search_results else "No search results found."}
        
        CRITICAL INSTRUCTIONS:
        1. Internal Knowledge: Even if search results are empty or thin, use your internal training data. Many major agencies (like We Make Websites, Fostr, Pinpoint) have well-known parent companies.
        2. Parent Discovery: If "{agency_name}" has a parent, identify it. If "{agency_name}" is the group head (e.g. "IDHL Group"), identify it as such.
        3. Sibling Discovery: List OTHER agencies in the same group. For IDHL, siblings include Pinpoint, Fostr, Ampersand, NetConstruct. For BORN XDS, siblings include We Make Websites.
        4. Relevance: Only include relevant digital/marketing/ecommerce agencies.
        
        Return JSON ONLY:
        {{
          "is_group_member": boolean,
          "parent_company": "Name of Group or NULL",
          "siblings": ["Agency Name 1", "Agency Name 2"],
          "confidence": 0-1,
          "reasoning": "Briefly explain (e.g., 'Internal knowledge confirmed BORN XDS acquisition')"
        }}
        """

        try:
            completion = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a corporate intelligence analyst. Return JSON ONLY."},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"}
            )
            
            result = json.loads(completion.choices[0].message.content)
            
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
            
            return result
        except Exception as e:
            sys.stderr.write(f"LLM analysis failed: {e}\n")
            return {"is_group_member": False, "parent_company": None, "siblings": [], "error": str(e)}

    def discover_more_siblings(self, parent_company: str, known_siblings: List[str], run_id: Optional[str] = None):
        """Actively searches for more agencies in a group if a parent is found."""
        if not self.ddgs or not parent_company or parent_company == "Self (Group Head)":
            return known_siblings

        query = f"list of agencies owned by {parent_company} group"
        try:
            results = self.ddgs.text(query, max_results=10)
            context = "\n".join([f"- {r['title']}: {r['body']}" for r in results])
            
            prompt = f"""
            Identify all agencies mentioned as being owned by or part of "{parent_company}".
            
            Context:
            {context}
            
            Known List (already found): {known_siblings}
            
            Return a combined, deduplicated list of ONLY relevant agencies (Digital, Marketing, Ecommerce). 
            Return JSON: {{"siblings": ["Name 1", "Name 2"]}}
            """
            
            completion = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "system", "content": "Return JSON ONLY."}, {"role": "user", "content": prompt}],
                response_format={"type": "json_object"}
            )
            
            new_siblings = json.loads(completion.choices[0].message.content).get("siblings", [])
            return list(set(known_siblings + new_siblings))
        except Exception as e:
            sys.stderr.write(f"Sibling discovery failed: {e}\n")
            return known_siblings

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Enrich Agency with Group/Parent Company info.")
    parser.add_argument("--agency", required=True, help="Agency Name")
    parser.add_argument("--run-id", help="Run ID for cost tracking")
    args = parser.parse_args()
    
    enricher = GroupEnricher()
    search_results = enricher.search_group_info(args.agency)
    analysis = enricher.analyze_group_membership(args.agency, search_results, run_id=args.run_id)
    
    print(json.dumps(analysis, indent=2))
