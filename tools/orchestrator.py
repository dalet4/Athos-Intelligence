
import os
import sys
import argparse
import subprocess
import json
import logging

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

def orchestrate(url: str):
    logging.info(f"🚀 Starting B.L.A.S.T. Orchestration for: {url}")
    
    # Step 1: Link/Scrape
    logging.info("--- Phase 1: Scraping (Link) ---")
    scrape_output_raw = run_tool("scrape_agency.py", args=["--url", url])
    
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

    # Step 2: Blueprint/Architect (Extract)
    logging.info("--- Phase 2: Extraction (Blueprint) ---")
    # We pipe markdown via stdin to extract_insights
    # extract_insights takes --url arg too for context
    extract_output_raw = run_tool("extract_insights.py", input_data=markdown_content, args=["--url", url])
    
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

    # Step 3: Trigger (Store)
    logging.info("--- Phase 3: Storage (Trigger) ---")
    store_output_raw = run_tool("store_data.py", input_data=extract_output_raw)
    
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
    logging.info("🏁 Orchestration Complete.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Orchestrator for Agency Intelligence Pipeline")
    parser.add_argument("--url", required=True, help="Target Agency URL")
    args = parser.parse_args()
    
    orchestrate(args.url)
