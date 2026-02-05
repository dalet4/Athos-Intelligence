# SOP 001: Agency Discovery & Analysis

## 🎯 Goal
Reliably extract structured data from a Digital Agency's website to populate the *Athos Commerce Intelligence Platform*.

## 📥 Inputs
- **Agency URL** (String): The entry point for discovery.
- **Firecrawl API Key**: For scraping.
- **OpenRouter API Key**: For intelligence extraction (Model agnostic).

## 🔄 Logic Flow (Navigation)
1.  **Ingest URL**: Validate functionality.
2.  **Scrape (Tool: `scrape_agency.py`)**:
    - Use Firecrawl to convert the website to Markdown.
    - If `scrape` fails -> Log error -> Skip.
3.  **Analysis (Tool: `extract_insights.py`)**:
    - Pass Markdown to LLM (GPT-4o).
    - Enforce JSON Schema (defined in `gemini.md`).
    - **Prompt Engineering**: "You are an expert agency analyst..."
4.  **Enrichment (Optional)**:
    - Cross-reference with LinkedIn (future scope).
5.  **Storage (Tool: `store_data.py`)**:
    - UPSERT into Supabase `agencies` table.

## 📤 Outputs
- **Structured JSON** matching `gemini.md` definition.
- **Supabase Record ID**.

## 🛑 Edge Cases
- **Anti-Scraping**: If Firecrawl is blocked, flag agency as `MANUAL_REVIEW`.
- **Empty Content**: If Markdown < 500 chars, flag as `INVALID_SITE`.
- **Hallucinations**: Reduce temperature to 0.0. Use strict schema mode.
