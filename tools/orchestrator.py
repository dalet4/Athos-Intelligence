
import os
import sys
import argparse
import subprocess
import json
import logging
import uuid
import hashlib
import time
from typing import Optional
from dotenv import load_dotenv
from supabase import create_client
from cost_manager import CostManager
import tracing

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))
_supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLE_KEY"))

def get_existing_hash(website: str) -> Optional[str]:
    """Fetch stored content_hash for a website from Supabase."""
    try:
        res = _supabase.table("agencies").select("content_hash").eq("website", website).limit(1).execute()
        if res.data:
            return res.data[0].get("content_hash")
    except Exception:
        pass
    return None

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def run_tool(script_name, input_data=None, args=None):
    """
    Runs a tool script as a subprocess.
    """
    tool_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), script_name)
    cmd = [sys.executable, tool_path]
    
    if args:
        cmd.extend(args)
        
    logging.info(f"Running tool: {script_name} with args: {args}")

    try:
        if input_data:
            process = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            stdout, stderr = process.communicate(input=input_data)
        else:
            process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            stdout, stderr = process.communicate()
            
        if process.returncode != 0:
            logging.error(f"Tool {script_name} failed with code {process.returncode}")
            logging.error(f"Stderr: {stderr}")
            return None
            
        return stdout.strip()

    except Exception as e:
        logging.error(f"Failed to execute {script_name}: {e}")
        return None

def orchestrate(url: str, model: str = None):
    """One trace per run: root span here, child span per phase, linked via TWOTAIL_PARENT_SPAN_ID."""
    run_id = str(uuid.uuid4())
    trace_id = run_id.replace("-", "")
    os.environ["TWOTAIL_TRACE_ID"] = trace_id
    root_span_id = tracing.new_span_id()
    root_start = time.time_ns()
    status_code = 1
    try:
        _run_pipeline(url, model, run_id, trace_id, root_span_id)
    except Exception:
        status_code = 2
        raise
    finally:
        tracing.send_span(
            trace_id, root_span_id, None, "orchestration",
            root_start, time.time_ns(),
            attributes={"target.url": url, "workflow.name": "blast_pipeline", "run.id": run_id},
            status_code=status_code,
        )


def _run_pipeline(url: str, model, run_id, trace_id, root_span_id):
    logging.info(f"🚀 Starting B.L.A.S.T. Orchestration (Run ID: {run_id}) for: {url}")
    if model:
        logging.info(f"🤖 Model override: {model}")

    # Step 1: Link/Scrape
    logging.info("--- Phase 1: Scraping (Link) ---")
    scrape_args = ["--url", url, "--run-id", run_id]
    if model:
        scrape_args += ["--model", model]
    _span_id, _start = tracing.new_span_id(), time.time_ns()
    os.environ["TWOTAIL_PARENT_SPAN_ID"] = _span_id
    scrape_output_raw = run_tool("scrape_agency.py", args=scrape_args)
    tracing.send_span(trace_id, _span_id, root_span_id, "scrape", _start, time.time_ns(),
                       attributes={"target.url": url}, status_code=1 if scrape_output_raw else 2)
    
    if not scrape_output_raw:
        logging.error("Scraping failed. Aborting.")
        return

    try:
        scrape_json = json.loads(scrape_output_raw)
        if not scrape_json.get("success"):
            logging.error(f"Scraper reported failure: {scrape_json.get('error')}")
            return
        
        markdown_content = scrape_json.get("markdown")
        if not markdown_content:
             logging.error("No markdown content returned.")
             return
             
    except json.JSONDecodeError:
        logging.error(f"Invalid JSON from scraper: {scrape_output_raw}")
        return

    logging.info(f"✅ Scrape successful. Length: {len(markdown_content)} chars")

    # Hash check — skip extraction if content unchanged
    new_hash = hashlib.sha256(markdown_content.encode()).hexdigest()
    existing_hash = get_existing_hash(url)
    if existing_hash and existing_hash == new_hash:
        logging.info("⏭️  Content unchanged (hash match). Skipping extraction — no LLM cost incurred.")
        return

    # Step 2: Blueprint/Architect (Extract)
    logging.info("--- Phase 2: Extraction (Blueprint) ---")
    extract_args = ["--url", url, "--run-id", run_id]
    if model:
        extract_args += ["--model", model]
    _span_id, _start = tracing.new_span_id(), time.time_ns()
    os.environ["TWOTAIL_PARENT_SPAN_ID"] = _span_id
    extract_output_raw = run_tool("extract_insights.py", input_data=markdown_content, args=extract_args)
    tracing.send_span(trace_id, _span_id, root_span_id, "extract", _start, time.time_ns(),
                       status_code=1 if extract_output_raw else 2)
    
    if not extract_output_raw:
        logging.error("Extraction failed. Aborting.")
        return
        
    try:
        # Check if output looks like JSON error
        extract_json = json.loads(extract_output_raw)
        if "error" in extract_json:
             logging.error(f"Extraction reported error: {extract_json['error']}")
             return
    except json.JSONDecodeError:
         logging.error(f"Invalid JSON from extractor: {extract_output_raw}")
         return
         
    logging.info("✅ Extraction successful. Insights generated.")

    # Step 2.5: Growth Monitoring (Social/News)
    logging.info("--- Phase 2.5: Growth Monitoring (Signal Check) ---")
    _enrich_span_id, _enrich_start = tracing.new_span_id(), time.time_ns()
    os.environ["TWOTAIL_PARENT_SPAN_ID"] = _enrich_span_id
    try:
        # Agency Name is needed for search. Extracted data has it.
        extract_json_obj = json.loads(extract_output_raw)
        agency_name = extract_json_obj.get("name")
        
        if agency_name:
            monitor_output_raw = run_tool("monitor_growth.py", args=["--agency", agency_name, "--run-id", run_id])
            if monitor_output_raw:
                try:
                    monitor_json = json.loads(monitor_output_raw)
                    
                    # Merge logic: Format structured news into strings to match Agency schema
                    formatted_news = [f"{n.get('title')} ({n.get('url')})" for n in monitor_json.get("news", [])]
                    extract_json_obj["recent_news"] = extract_json_obj.get("recent_news", []) + formatted_news
                    
                    # Add social mentions (flattened)
                    # We store them as a list of strings or objects? Let's use objects if Supabase allows, 
                    # but for consistency with 'recent_news' schema, let's stringify or assume store_data handles it.
                    # Actually, let's keep it structured for social_mentions as it's a new field.
                    # But store_data needs to put it somewhere. 
                    # Let's stringify for now to be safe with existing text[] columns if applicable, 
                    # or assume JSONB.
                    # Let's just add it to top level.
                    # Add classified growth signals (new field)
                    extract_json_obj["growth_signals"] = monitor_json.get("classified_signals", [])

                    # Logging
                    logging.info(f"✅ Growth signals merged. Added {len(formatted_news)} news items and {len(extract_json_obj['growth_signals'])} classified signals.")
                except Exception as e:
                     logging.error(f"Failed to merge growth data: {e}")
            else:
                logging.warning("Growth monitor returned no output. Skipping merge.")

            # Step 2.6: Group Identification & Recursive Discovery
            logging.info("--- Phase 2.6: Group Identification & Recursive Discovery ---")
            
            # Use the GroupEnricher directly for recursive logic
            from enrich_group import GroupEnricher
            
            enricher = GroupEnricher()
            search_results = enricher.search_group_info(agency_name)
            group_json = enricher.analyze_group_membership(agency_name, search_results, run_id=run_id)
            
            if group_json.get("parent_company") and group_json.get("parent_company") != "Self (Group Head)":
                parent = group_json.get("parent_company")
                known_siblings = group_json.get("siblings", [])
                
                # Recursive Discovery Step
                logging.info(f"🔍 Parent found: {parent}. Searching for sibling agencies...")
                all_siblings = enricher.discover_more_siblings(parent, known_siblings, run_id=run_id)
                group_json["siblings"] = all_siblings
                logging.info(f"✅ Discovered {len(all_siblings)} agencies in {parent} group.")
                
                # Automatic Lead Ingestion
                from supabase import create_client
                _supa_url = os.getenv("SUPABASE_URL")
                _supa_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
                _supa = create_client(_supa_url, _supa_key) if (_supa_url and _supa_key) else None

                for sibling in all_siblings:
                    sibling_clean = sibling.strip()
                    if sibling_clean.lower() == agency_name.lower():
                        continue
                    if _supa:
                        # Exact case-insensitive match first
                        exists = _supa.table("agencies").select("id").ilike("name", sibling_clean).execute()
                        if not exists.data:
                            # Partial match to catch name variations (e.g. "Agency Ltd" vs "Agency")
                            fuzzy = _supa.table("agencies").select("id").ilike("name", f"%{sibling_clean}%").execute()
                            exists = fuzzy
                        if not exists.data:
                            logging.info(f"✨ Ingesting new discovered lead: {sibling_clean}")
                            _supa.table("agencies").insert({
                                "name": sibling_clean,
                                "parent_company": parent,
                                "is_group_member": True,
                                "description": f"Discovered sibling agency of {agency_name} via {parent} group."
                            }).execute()
                        else:
                            logging.info(f"⏭️ Sibling lead '{sibling_clean}' already exists. Skipping ingestion.")

            extract_json_obj["is_part_of_group"] = group_json.get("is_group_member", False)
            extract_json_obj["parent_company"] = group_json.get("parent_company")
            extract_json_obj["sibling_agencies"] = group_json.get("siblings", [])
            logging.info(f"✅ Group identification complete: {extract_json_obj['parent_company'] or 'Independent'}")
            
            # Re-serialize updated extract_json_obj for the storage phase
            extract_output_raw = json.dumps(extract_json_obj)
        else:
             logging.warning("No agency name found in extraction. Skipping subsequent enrichment steps.")
             
    except Exception as e:
        logging.error(f"Enrichment phases failed (non-fatal): {e}")
    finally:
        tracing.send_span(trace_id, _enrich_span_id, root_span_id, "enrich", _enrich_start, time.time_ns())

    # Step 3: Trigger (Store)
    logging.info("--- Phase 3: Storage (Trigger) ---")
    _span_id, _start = tracing.new_span_id(), time.time_ns()
    os.environ["TWOTAIL_PARENT_SPAN_ID"] = _span_id
    store_output_raw = run_tool("store_data.py", input_data=extract_output_raw)
    tracing.send_span(trace_id, _span_id, root_span_id, "store", _start, time.time_ns(),
                       status_code=1 if store_output_raw else 2)
    
    if not store_output_raw:
        logging.error("Storage failed. Aborting.")
        return
        
    try:
        store_json = json.loads(store_output_raw)
        if not store_json.get("success"):
            logging.error(f"Storage failed: {store_json.get('error')}")
            return
    except json.JSONDecodeError:
        logging.error(f"Invalid JSON from storage: {store_output_raw}")
        return
        
    logging.info("✅ Data successfully stored in Intelligence Platform.")
    
    # Step 4: Scoring (Lead Scoring Agent)
    logging.info("--- Phase 4: Scoring (Lead Scoring Agent) ---")
    try:
        agency_id = store_json.get("id")
        if agency_id:
            _span_id, _start = tracing.new_span_id(), time.time_ns()
            os.environ["TWOTAIL_PARENT_SPAN_ID"] = _span_id
            score_output_raw = run_tool("score_leads.py", args=["--id", agency_id])
            tracing.send_span(trace_id, _span_id, root_span_id, "score", _start, time.time_ns(),
                               status_code=1 if score_output_raw else 2)
            if score_output_raw:
                score_json = json.loads(score_output_raw)
                if score_json.get("success"):
                    res = score_json["results"][0]
                    logging.info(f"✅ Lead Score calculated: {res['score']} / 100")
                else:
                    logging.error(f"Scoring logic failed: {score_json.get('error')}")
            else:
                 logging.error("Scoring tool returned no output.")
        else:
            logging.warning("No agency ID found in storage output. Skipping scoring.")
    except Exception as e:
        logging.error(f"Scoring phase failed (non-fatal): {e}")
    
    # Cost Summary
    cm = CostManager()
    summary = cm.get_run_summary(run_id)
    logging.info("--- Run Cost Summary ---")
    logging.info(f"Total Cost: ${summary['total_cost']:.4f}")
    for item in summary['details']:
        logging.info(f"  - {item['model']}: {item['prompt_tokens']} prompt, {item['completion_tokens']} completion tokens (${item['cost']:.4f})")
    
    logging.info("🏁 Orchestration Complete.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Orchestrator for Agency Intelligence Pipeline")
    parser.add_argument("--url", required=True, help="Target Agency URL")
    parser.add_argument("--model", help="Override LLM model for all pipeline steps (e.g. openai/gpt-4o-mini). Run 'python cost_manager.py --models' to see options.")
    args = parser.parse_args()

    orchestrate(args.url, model=args.model)
