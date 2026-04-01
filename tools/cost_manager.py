import sqlite3
import os
import json
from datetime import datetime

# ANSI color codes
_R = "\033[0m"       # reset
_BOLD = "\033[1m"
_GREEN = "\033[32m"
_YELLOW = "\033[33m"
_RED = "\033[31m"
_CYAN = "\033[36m"
_DIM = "\033[2m"

class CostManager:
    # Pricing per 1M tokens (Input, Output) in USD
    PRICING = {
        # Legacy / direct OpenAI names
        "gpt-4-turbo-preview": (10.00, 30.00),
        "gpt-4o": (5.00, 15.00),
        "gpt-4o-mini": (0.15, 0.60),
        "gpt-4o-2024-08-06": (2.50, 10.00),
        # OpenRouter-prefixed names
        "openai/gpt-4-turbo-preview": (10.00, 30.00),
        "openai/gpt-4-turbo": (10.00, 30.00),
        "openai/gpt-4o": (5.00, 15.00),
        "openai/gpt-4o-mini": (0.15, 0.60),
        "openai/gpt-4o-2024-08-06": (2.50, 10.00),
        "google/gemini-flash-1.5": (0.075, 0.30),
        "google/gemini-2.0-flash-001": (0.10, 0.40),
        "anthropic/claude-3-haiku": (0.25, 1.25),
        "anthropic/claude-3.5-haiku": (0.80, 4.00),
        "anthropic/claude-3-sonnet": (3.00, 15.00),
        "anthropic/claude-3-opus": (15.00, 75.00),
        "meta-llama/llama-3.1-8b-instruct:free": (0.00, 0.00),
        # Legacy keys (no prefix)
        "claude-3-opus": (15.00, 75.00),
        "claude-3-sonnet": (3.00, 15.00),
        "claude-3-haiku": (0.25, 1.25),
    }

    # Model catalog for the --models chart.
    # Each entry: (display_name, openrouter_id, input_$/1M, output_$/1M,
    #              link_quality, extract_quality, classify_quality, notes)
    # Quality: 1-5 stars. Tasks: link=find_subpages, extract=extract_insights, classify=monitor_growth
    MODEL_CATALOG = [
        {
            "name": "Llama 3.1 8B (free)",
            "id": "meta-llama/llama-3.1-8b-instruct:free",
            "input": 0.00, "output": 0.00,
            "link": 3, "extract": 2, "classify": 3,
            "note": "Free tier, rate-limited. OK for simple tasks.",
        },
        {
            "name": "Gemini Flash 1.5",
            "id": "google/gemini-flash-1.5",
            "input": 0.075, "output": 0.30,
            "link": 5, "extract": 4, "classify": 5,
            "note": "Best value. Excellent for link extraction & classification.",
        },
        {
            "name": "Gemini 2.0 Flash",
            "id": "google/gemini-2.0-flash-001",
            "input": 0.10, "output": 0.40,
            "link": 5, "extract": 4, "classify": 5,
            "note": "Slightly newer than Flash 1.5, similar price.",
        },
        {
            "name": "GPT-4o Mini",
            "id": "openai/gpt-4o-mini",
            "input": 0.15, "output": 0.60,
            "link": 5, "extract": 4, "classify": 5,
            "note": "Supports JSON Schema mode. Best all-rounder for cost.",
        },
        {
            "name": "Claude 3 Haiku",
            "id": "anthropic/claude-3-haiku",
            "input": 0.25, "output": 1.25,
            "link": 4, "extract": 4, "classify": 5,
            "note": "Fast and cheap. Strong instruction-following.",
        },
        {
            "name": "Claude 3.5 Haiku",
            "id": "anthropic/claude-3.5-haiku",
            "input": 0.80, "output": 4.00,
            "link": 4, "extract": 5, "classify": 5,
            "note": "Better reasoning than Haiku, still cheap.",
        },
        {
            "name": "GPT-4o (2024-08-06)",
            "id": "openai/gpt-4o-2024-08-06",
            "input": 2.50, "output": 10.00,
            "link": 5, "extract": 5, "classify": 5,
            "note": "High-quality structured outputs. Use only if mini underperforms.",
        },
        {
            "name": "Claude 3 Sonnet",
            "id": "anthropic/claude-3-sonnet",
            "input": 3.00, "output": 15.00,
            "link": 5, "extract": 5, "classify": 5,
            "note": "Premium quality. Overkill for most pipeline tasks.",
        },
        {
            "name": "GPT-4o",
            "id": "openai/gpt-4o",
            "input": 5.00, "output": 15.00,
            "link": 5, "extract": 5, "classify": 5,
            "note": "Premium. Only justified for very nuanced extractions.",
        },
        {
            "name": "GPT-4 Turbo",
            "id": "openai/gpt-4-turbo-preview",
            "input": 10.00, "output": 30.00,
            "link": 5, "extract": 5, "classify": 5,
            "note": "Expensive legacy model. Not recommended.",
        },
    ]

    # Typical token usage per task (prompt_tokens, completion_tokens)
    TASK_TOKENS = {
        "link_extraction": (3_000, 150),
        "structured_extraction": (20_000, 800),
        "classification": (500, 200),
    }

    @classmethod
    def estimate_task_cost(cls, model_entry, task):
        p_tok, c_tok = cls.TASK_TOKENS[task]
        cost = (p_tok / 1_000_000) * model_entry["input"] + \
               (c_tok / 1_000_000) * model_entry["output"]
        return cost

    @classmethod
    def show_model_chart(cls):
        BAR_MAX = 30  # max bar width chars
        TASKS = [
            ("link_extraction",        "link",     "Link Extraction    (~3K tokens)"),
            ("structured_extraction",  "extract",  "Struct. Extraction (~20K tokens)"),
            ("classification",         "classify", "Classification     (~500 tokens)"),
        ]

        # Recommendations per task (model id)
        RECOMMENDED = {
            "link_extraction": "google/gemini-flash-1.5",
            "structured_extraction": "openai/gpt-4o-mini",
            "classification": "openai/gpt-4o-mini",
        }

        print(f"\n{_BOLD}{'─'*72}{_R}")
        print(f"{_BOLD}  MODEL COST CHART  —  OpenRouter Models for Agency Pipeline{_R}")
        print(f"{_BOLD}{'─'*72}{_R}")

        for task_key, quality_key, task_label in TASKS:
            costs = [(m, cls.estimate_task_cost(m, task_key)) for m in cls.MODEL_CATALOG]
            max_cost = max(c for _, c in costs) or 1.0

            print(f"\n  {_CYAN}{_BOLD}▶ {task_label}{_R}")
            print(f"  {'Model':<26} {'$/run':>8}   {'Cost bar':<32}  {'Quality':>7}  ")
            print(f"  {'─'*26} {'─'*8}   {'─'*32}  {'─'*7}")

            for m, cost in costs:
                is_rec = (m["id"] == RECOMMENDED[task_key])
                quality = m[quality_key]
                stars = "★" * quality + _DIM + "☆" * (5 - quality) + _R

                bar_len = int((cost / max_cost) * BAR_MAX) if cost > 0 else 0
                if cost == 0:
                    bar = _GREEN + "FREE" + _R
                    cost_str = _GREEN + "  FREE  " + _R
                elif cost < 0.001:
                    bar = _GREEN + "█" * max(bar_len, 1) + _R
                    cost_str = _GREEN + f"${cost:.5f}" + _R
                elif cost < 0.01:
                    bar = _GREEN + "█" * bar_len + _R
                    cost_str = _GREEN + f"${cost:.4f} " + _R
                elif cost < 0.05:
                    bar = _YELLOW + "█" * bar_len + _R
                    cost_str = _YELLOW + f"${cost:.4f} " + _R
                else:
                    bar = _RED + "█" * bar_len + _R
                    cost_str = _RED + f"${cost:.4f} " + _R

                rec_badge = f"  {_GREEN}{_BOLD}◀ RECOMMENDED{_R}" if is_rec else ""
                name_str = f"{_BOLD}{m['name']}{_R}" if is_rec else m["name"]

                print(f"  {name_str:<26} {cost_str}   {bar:<32}  {stars}{rec_badge}")

        print(f"\n  {_BOLD}Notes:{_R}")
        for m in cls.MODEL_CATALOG:
            print(f"  {_DIM}{m['id']:<45}{_R}  {m['note']}")

        print(f"\n  {_BOLD}Usage:{_R}  python orchestrator.py --url <url> --model <model_id>")
        print(f"           python extract_insights.py --url <url> --model openai/gpt-4o-mini")
        print(f"           python scrape_agency.py --url <url> --model google/gemini-flash-1.5")
        print(f"{_BOLD}{'─'*72}{_R}\n")

    def __init__(self, db_path=None):
        if db_path is None:
            db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "costs.db")
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS llm_usage (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    run_id TEXT,
                    model TEXT,
                    prompt_tokens INTEGER,
                    completion_tokens INTEGER,
                    cost REAL,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """)

    def calculate_cost(self, model, prompt_tokens, completion_tokens):
        pricing = self.PRICING.get(model, (0, 0))
        input_cost = (prompt_tokens / 1_000_000) * pricing[0]
        output_cost = (completion_tokens / 1_000_000) * pricing[1]
        return input_cost + output_cost

    def record_usage(self, run_id, model, prompt_tokens, completion_tokens):
        cost = self.calculate_cost(model, prompt_tokens, completion_tokens)
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                INSERT INTO llm_usage (run_id, model, prompt_tokens, completion_tokens, cost)
                VALUES (?, ?, ?, ?, ?)
            """, (run_id, model, prompt_tokens, completion_tokens, cost))
        return cost

    def get_period_stats(self):
        """Returns all-time, monthly, and weekly cost breakdowns from the local DB."""
        with sqlite3.connect(self.db_path) as conn:
            periods = {
                "all_time":  ("All Time",  "1=1"),
                "monthly":   ("This Month","strftime('%Y-%m', timestamp) = strftime('%Y-%m', 'now')"),
                "weekly":    ("This Week", "timestamp >= datetime('now', '-7 days')"),
            }
            result = {}
            for key, (label, where) in periods.items():
                cursor = conn.execute(f"""
                    SELECT
                        COALESCE(SUM(cost), 0)             AS total_cost,
                        COALESCE(SUM(prompt_tokens), 0)    AS total_prompt,
                        COALESCE(SUM(completion_tokens), 0) AS total_completion,
                        COUNT(DISTINCT run_id)             AS runs
                    FROM llm_usage
                    WHERE {where}
                """)
                row = cursor.fetchone()
                # Top models
                cur2 = conn.execute(f"""
                    SELECT model, SUM(cost) AS spend
                    FROM llm_usage
                    WHERE {where}
                    GROUP BY model
                    ORDER BY spend DESC
                    LIMIT 3
                """)
                top_models = [{"model": r[0], "cost": r[1]} for r in cur2.fetchall()]
                result[key] = {
                    "label": label,
                    "total_cost": row[0],
                    "prompt_tokens": row[1],
                    "completion_tokens": row[2],
                    "runs": row[3],
                    "top_models": top_models,
                }
            return result

    @classmethod
    def show_stats(cls, db_path=None):
        """Print a cost summary table for all-time, monthly, and weekly."""
        cm = cls(db_path)
        stats = cm.get_period_stats()

        print(f"\n{_BOLD}{'─'*60}{_R}")
        print(f"{_BOLD}  OPENROUTER COST SUMMARY{_R}")
        print(f"{_BOLD}{'─'*60}{_R}\n")

        for key in ("weekly", "monthly", "all_time"):
            s = stats[key]
            total = s["total_cost"]
            color = _GREEN if total < 0.10 else (_YELLOW if total < 1.00 else _RED)
            print(f"  {_BOLD}{_CYAN}{s['label']}{_R}")
            print(f"    Cost:   {color}{_BOLD}${total:.4f}{_R}")
            print(f"    Runs:   {s['runs']}")
            print(f"    Tokens: {s['prompt_tokens']:,} prompt  /  {s['completion_tokens']:,} completion")
            if s["top_models"]:
                print(f"    Top models:")
                for m in s["top_models"]:
                    print(f"      {_DIM}{m['model']:<45}{_R}  ${m['cost']:.4f}")
            print()

        print(f"{_BOLD}{'─'*60}{_R}\n")

    def get_run_summary(self, run_id):
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute("""
                SELECT model, SUM(prompt_tokens), SUM(completion_tokens), SUM(cost)
                FROM llm_usage
                WHERE run_id = ?
                GROUP BY model
            """, (run_id,))
            rows = cursor.fetchall()
            
            summary = []
            total_cost = 0
            for row in rows:
                summary.append({
                    "model": row[0],
                    "prompt_tokens": row[1],
                    "completion_tokens": row[2],
                    "cost": row[3]
                })
                total_cost += row[3]
            
            return {"total_cost": total_cost, "details": summary}

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Cost Manager CLI")
    parser.add_argument("--summary", help="Get summary for a run ID")
    parser.add_argument("--all", action="store_true", help="Get total cost for all runs")
    parser.add_argument("--models", action="store_true", help="Show model cost chart and recommendations")
    parser.add_argument("--stats", action="store_true", help="Show all-time, monthly, and weekly cost summary")
    args = parser.parse_args()

    if args.models:
        CostManager.show_model_chart()
        exit(0)

    if args.stats:
        CostManager.show_stats()
        exit(0)

    cm = CostManager()
    if args.summary:
        summary = cm.get_run_summary(args.summary)
        print(json.dumps(summary, indent=2))
    elif args.all:
        with sqlite3.connect(cm.db_path) as conn:
            cursor = conn.execute("SELECT SUM(cost) FROM llm_usage")
            result = cursor.fetchone()[0]
            if result is None:
                print("No costs recorded yet.")
            else:
                print(f"Total historical cost: ${result:.4f}")
    else:
        parser.print_help()
