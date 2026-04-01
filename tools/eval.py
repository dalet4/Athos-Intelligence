"""
eval.py — Automated scoring for the extract_insights.py optimisation loop.

Usage:
    python eval.py                          # Run all test agencies, print scores
    python eval.py --agency velstar         # Run a single agency
    python eval.py --verbose                # Show per-assertion breakdown

The agent uses this to score each iteration. Output is a single score (0.0–1.0)
plus a breakdown. Append results to program.md manually or with --log.
"""

import sys
import json
import argparse
import subprocess
from pathlib import Path

# ---------------------------------------------------------------------------
# Test set: slug → URL
# ---------------------------------------------------------------------------
TEST_AGENCIES = {
    "velstar":      "https://www.velstar.co.uk",
    "ampersand":    "https://www.ampersand.agency",
    "netconstruct": "https://www.netconstruct.com",
}

DATA_DIR = Path(__file__).parent / "data"

# ---------------------------------------------------------------------------
# Binary assertions
# ---------------------------------------------------------------------------
def run_assertions(data: dict, raw_content: str = "") -> dict[str, bool]:
    """Return a dict of assertion_name → bool."""

    def nonempty_list(val, min_items=1):
        return isinstance(val, list) and len(val) >= min_items

    def nonempty_str(val, min_len=1):
        return isinstance(val, str) and len(val.strip()) >= min_len

    results = {}

    # 1. Schema valid — no error key in output
    results["schema_valid"] = "error" not in data

    if "error" in data:
        # All remaining assertions fail if schema is invalid
        for k in ["name", "description_quality", "revenue_estimated",
                  "headcount_found", "specializations", "office_locations",
                  "directors", "tech_stack", "competitor_intelligence"]:
            results[k] = False
        return results

    # 2. Name extracted
    results["name"] = nonempty_str(data.get("name"), min_len=2)

    # 3. Description quality
    results["description_quality"] = nonempty_str(data.get("description"), min_len=80)

    # 4. Revenue estimated
    results["revenue_estimated"] = nonempty_str(data.get("revenue_estimate"))

    # 5. Headcount found
    results["headcount_found"] = nonempty_str(data.get("headcount"))

    # 6. Specializations populated
    results["specializations"] = nonempty_list(data.get("specializations"), min_items=2)

    # 7. Office locations found
    results["office_locations"] = nonempty_list(data.get("office_locations"), min_items=1)

    # 8. Directors extracted
    # Pass if directors populated, OR if the scraped content has no detectable
    # named individuals (meaning enrichment is the appropriate source, not the website).
    # A "named individual" requires a Firstname Lastname pattern within 120 chars
    # of a job title keyword — filters out UI phrases like "Shopify Plus", "Our Team".
    directors_populated = nonempty_list(data.get("directors"), min_items=1)
    if not directors_populated:
        import re
        JOB_TITLE_KEYWORDS = (
            r'(?:CEO|CTO|COO|CFO|Founder|Co-Founder|Managing Director|'
            r'Head of|Principal|President|Vice President)'
        )
        person_pattern = re.compile(
            r'(?:'
            r'[A-Z][a-z]+\s+[A-Z][a-z]+[^\n]{0,80}' + JOB_TITLE_KEYWORDS +
            r'|' + JOB_TITLE_KEYWORDS + r'[^\n]{0,80}[A-Z][a-z]+\s+[A-Z][a-z]+'
            r')',
            re.MULTILINE,
        )
        names_in_content = bool(person_pattern.search(raw_content))
        directors_populated = not names_in_content
    results["directors"] = directors_populated

    # 9. Tech stack populated
    results["tech_stack"] = nonempty_list(data.get("tech_stack"), min_items=2)

    # 10. Competitor intelligence checked
    # Pass if competitor_partnerships is populated, OR if the raw scraped content
    # contains no known competitor names (meaning absence is correct).
    KNOWN_COMPETITORS = [
        "klaviyo", "yotpo", "gorgias", "recharge", "attentive",
        "postscript", "okendo", "reviews.io", "loop returns"
    ]
    partnerships = data.get("competitor_partnerships", [])
    content_lower = raw_content.lower()
    competitors_in_content = any(c in content_lower for c in KNOWN_COMPETITORS)
    if competitors_in_content:
        # Content mentions competitors — we expect them to be extracted
        results["competitor_intelligence"] = nonempty_list(partnerships, min_items=1)
    else:
        # No competitors in source content — empty list is correct
        results["competitor_intelligence"] = True

    return results


# ---------------------------------------------------------------------------
# Run extraction for one agency
# ---------------------------------------------------------------------------
def extract_agency(slug: str, url: str) -> tuple[dict, str]:
    """Run extract_insights.py on cached markdown. Returns (parsed_json, raw_markdown)."""
    cache_file = DATA_DIR / f"{slug}.md"

    if not cache_file.exists():
        return {"error": f"No cached file at {cache_file}. Run scrape_agency.py first."}, ""

    raw_markdown = cache_file.read_text(encoding="utf-8")

    result = subprocess.run(
        [sys.executable, str(Path(__file__).parent / "extract_insights.py"), "--file", str(cache_file), "--url", url],
        capture_output=True,
        text=True,
        cwd=Path(__file__).parent,
    )

    stdout = result.stdout.strip()
    if not stdout:
        return {"error": result.stderr.strip() or "Empty output"}, raw_markdown

    try:
        return json.loads(stdout), raw_markdown
    except json.JSONDecodeError:
        return {"error": f"Invalid JSON: {stdout[:200]}"}, raw_markdown


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description="Score extract_insights.py against test set.")
    parser.add_argument("--agency", help="Run a single agency by slug")
    parser.add_argument("--verbose", action="store_true", help="Show per-assertion breakdown")
    args = parser.parse_args()

    agencies = (
        {args.agency: TEST_AGENCIES[args.agency]}
        if args.agency and args.agency in TEST_AGENCIES
        else TEST_AGENCIES
    )

    ASSERTION_NAMES = [
        "schema_valid", "name", "description_quality", "revenue_estimated",
        "headcount_found", "specializations", "office_locations",
        "directors", "tech_stack", "competitor_intelligence"
    ]

    total_passed = 0
    total_possible = len(ASSERTION_NAMES) * len(agencies)
    agency_scores = {}

    for slug, url in agencies.items():
        data, raw_markdown = extract_agency(slug, url)
        assertions = run_assertions(data, raw_markdown)
        passed = sum(assertions.values())
        total_passed += passed
        agency_scores[slug] = (passed, len(ASSERTION_NAMES), assertions)

        if args.verbose:
            print(f"\n── {slug} ({passed}/{len(ASSERTION_NAMES)}) ──")
            for name in ASSERTION_NAMES:
                icon = "✓" if assertions[name] else "✗"
                print(f"  {icon}  {name}")

    score = total_passed / total_possible if total_possible > 0 else 0.0

    print(f"\n{'─' * 40}")
    print(f"SCORE: {score:.2f}  ({total_passed}/{total_possible} assertions passed)")
    print(f"{'─' * 40}")

    if not args.verbose:
        for slug, (passed, total, _) in agency_scores.items():
            bar = "█" * passed + "░" * (total - passed)
            print(f"  {slug:<20} {bar}  {passed}/{total}")

    print()
    return score


if __name__ == "__main__":
    main()
