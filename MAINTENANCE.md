# Maintenance & Operations Log

## 🚀 Deployment Guide (Modal)

The Athos Intelligence Platform uses **Modal** for cloud execution.

### Prerequisites
-   Modal account & CLI installed (`pip install modal`).
-   Authenticated (`modal token new`).
-   Secrets configured (`modal secret create athos-secrets ...`).

### Deploying the App
To deploy the latest version of the analysis logic, webhook, and scheduler:

```bash
modal deploy tools/modal_app.py
```

This will output the **Webhook URL** (e.g., `https://your-username--athos-platform-analyze-agency-webhook.modal.run`).

### Running Locally (Cloud Hybrid)
To test the logic using your local code but executing on Modal's infrastructure:

```bash
modal run tools/modal_app.py --url "https://target-agency.com"
```

## 🔄 Automated Triggers

### 1. Webhook (On-Demand)
Trigger an analysis via HTTP POST. Useful for connecting to the Dashboard or external forms.

**Endpoint:** `[WEBHOOK_URL]`  
**Method:** `POST`  
**Payload:**
```json
{
  "url": "https://www.target-agency.com"
}
```

### 2. Scheduled Re-analysis (Cron)
-   **Schedule:** Runs daily at **00:00 UTC**.
-   **Logic:** Checks Supabase `agencies` table for records where `last_analyzed` is older than **30 days**.
-   **Action:** Triggers `analyze_agency` for each stale record.

## 🛠 Troubleshooting

### Logs
View logs for your application in the [Modal Dashboard](https://modal.com/dashboard).

### Common Issues
-   **Scrape Failures**: Check Firecrawl quota or site blocking policies.
-   **Supabase Connection**: Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in Modal Secrets.
-   **Timeouts**: Analysis has a 600s (10 minute) timeout. Complex sites may exceed this.

## 📝 Update Log

| Date       | Version | Changes |
| :---       | :---    | :--- |
| 2024-01-20 | v1.0    | Initial deployment with Webhook and Daily Cron Schedule. |
