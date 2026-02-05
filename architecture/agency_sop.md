# SOP: Agency Analysis Protocol

**Goal**: Convert a raw Agency URL into a complete Intelligence Dossier.

## 1. Input
- **Agency URL** (e.g. `https://velstar.co.uk`)

## 2. The Crawl (Layer 1)
- **Tool**: `scrape_agency.py` (Crawler Mode)
- **Logic**:
    1.  Fetch Homepage.
    2.  Use LLM to identify "About Us", "Team", and "Partners" links.
    3.  Crawl those sub-pages to gather maximum context.

## 3. Extraction (Layer 2)
- **Tool**: OpenAI (`gpt-4-turbo-preview`)
- **Schema Target**: `directors`, `awards`, `revenue_estimate`, `partners`.
- **Rule**: If `revenue_estimate` is missing, estimate based on headcount (~$150k/head).

## 4. Enrichment (Layer 3)
- **Tool**: `enrich_hunter.py`
- **Logic**:
    1.  Extract domain from URL.
    2.  Query Hunter.io for "Executive" emails.
    3.  Merge with OpenAI-found Directors (Deduplicate by Name).

## 5. Storage (Layer 4)
- **Tool**: `store_data.py`
- **Target**: Supabase (`agencies` table).
- **Constraint**: Upsert on `website` (PK).

## 6. Visualization
- **UI**: `PartnerProfileDialog.tsx`
- **Display**: Show Green Badge for Revenue, Grid for Directors, List for Awards.
