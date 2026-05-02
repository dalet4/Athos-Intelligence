# Athos Intelligence — Features Overview

**Athos Intelligence** is an AI-powered agency intelligence and lead generation platform. It helps find, analyze, enrich, and score digital agencies as potential partnership or client targets.

---

## Architecture

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript, Vite, Tailwind CSS, shadcn/ui |
| State / Data | TanStack React Query, Supabase |
| Backend Tools | Python 3, Modal (serverless) |
| Edge Functions | Deno (Supabase Edge Functions) |
| LLMs | OpenRouter (GPT-4o, Claude, Gemini, Llama) |
| Scraping | FireCrawl |
| Company Data | Companies House API (UK) |
| Contacts | Hunter.io |

---

## Feature Areas

### 1. Agency Data Management

- Store comprehensive agency profiles with 30+ fields: name, website, description, revenue estimates, specialisations, platforms, clients, case studies, directors, awards, tech stack, and office locations
- Edit and delete individual records
- Automatic deduplication — handles group members and holding companies
- Full-text search across all agency fields

### 2. Import System

**CSV Import**
- Flexible column mapping with auto-detection of common variants (`Vendor`, `Company`, etc.)
- File preview before committing the import
- Batch processing for large files

**URL Import**
- Paste a website URL and the system scrapes and structures the agency profile automatically
- Smart URL validation and normalisation

### 3. AI Enrichment Pipeline

The enrichment pipeline runs in stages, triggered on demand or in batch:

1. **Web scraping** — FireCrawl converts agency websites to clean markdown
2. **Link extraction** — LLM identifies About, Team, Partners, and Careers page URLs
3. **Structured extraction** — LLM parses page content into 15+ typed fields
4. **Companies House lookup** — fetches official UK registration data, directors, and financials
5. **Contact enrichment** — Hunter.io discovers email addresses for key contacts
6. **Growth signal classification** — detects hiring activity, news mentions, and expansion signals
7. **Content hashing** — skips re-enrichment when a site hasn't changed

### 4. Lead Scoring

Each agency receives a score from 0–100 built from four components:

| Component | What it measures |
|-----------|-----------------|
| Revenue potential | Normalised revenue estimate tier |
| Growth signals | Hiring activity, news, geographic expansion |
| Alignment score | Tech stack and specialisation match |
| Competitive cluster | Bonus for agencies within a known holding group |

Score breakdowns are displayed visually on each agency card.

### 5. Dashboard & UI

**Bento Dashboard** (primary view)
- Card-based layout with live search and filters
- Per-card AI enrichment trigger
- Score breakdown overlay on each card

**Partner Dashboard** (legacy view)
- Grid and list view toggle
- Multi-field filtering (platform, specialisation, revenue tier)

**Agency Profile Dialog**
- Full detail view: clients, directors, case studies, awards, score breakdown
- Edit mode for manual data corrections

### 6. Model Selection & Cost Control

Users can assign a specific LLM to each enrichment task:

| Task | Model options |
|------|--------------|
| Structured extraction | GPT-4o, Claude 3.5 Haiku, Gemini Pro 1.5 |
| Link detection | GPT-4o Mini, Gemini Flash 1.5, Llama 3.1 (free) |
| Growth classification | Any configured model |

- Cost estimates displayed per task before running
- Quality ratings (1–5) shown alongside cost
- Preferences saved to LocalStorage

### 7. Usage & Cost Tracking

- Every LLM call is logged to the `llm_usage` Supabase table
- `openrouter-usage` edge function monitors API credit balance
- `cost_manager.py` generates cost reports by model and task type

### 8. Python Tools Suite

30+ Python utilities for offline data work:

| Category | Tools |
|----------|-------|
| Pipeline | `orchestrator.py`, `scrape_agency.py`, `extract_insights.py`, `refresh_all.py` |
| Enrichment | `enrich_company.py`, `enrich_group.py`, `enrich_hunter.py`, `batch_enrich_pms.py` |
| Scoring | `score_leads.py`, `monitor_growth.py`, `eval.py` |
| Database | `handshake_supabase.py`, `apply_migration.py`, `introspect_db.py` |
| Utilities | `cost_manager.py`, `cleanup_data.py`, `sync_agencies.py`, `modal_app.py` |

---

## Key Workflows

### Adding an Agency via URL

```
URL input → Validate → FireCrawl scrape → LLM extraction
→ Companies House lookup → Lead score calculation → Save to Supabase
```

### Batch Enrichment

```
All agencies → Detect stale records (content hash) → Scrape changed sites
→ Re-extract → Update scores → Log costs
```

### CSV Bulk Import

```
Upload CSV → Map columns → Preview → Validate → Insert (deduplicated) → Enrich queue
```

---

## Environment Variables

```env
VITE_SUPABASE_URL              # Supabase project URL
VITE_SUPABASE_ANON_KEY         # Public Supabase key
SUPABASE_SERVICE_ROLE_KEY      # Admin key (edge functions only)
OPENROUTER_API_KEY             # LLM access via OpenRouter
COMPANIES_HOUSE_API_KEY        # UK company registry
FIRECRAWL_API_KEY              # Web scraping
HUNTER_API_KEY                 # Email enrichment
```

---

## Key Source Files

| File | Purpose |
|------|---------|
| `Display/src/App.tsx` | React router and top-level layout |
| `Display/src/components/BentoDashboard.tsx` | Primary agency browser UI |
| `Display/src/components/SettingsDialog.tsx` | Model selection and cost config |
| `Display/src/types/agency.ts` | Core TypeScript type definitions |
| `Display/supabase/functions/fetch-agency-details/index.ts` | Main enrichment edge function |
| `tools/orchestrator.py` | Python pipeline entry point |
| `tools/score_leads.py` | Lead scoring algorithm |
| `tools/cost_manager.py` | LLM cost tracking and reporting |
