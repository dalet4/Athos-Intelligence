# Agency Growth & Competitor Tracking Update

We have implemented new capabilities to identify growing agencies and monitor competitor technology usage.

## Features Implemented

### 1. Growth Signals (The "Winner" Detector)

The system now automatically scans for:

- **Hiring Velocity**: Identifies open roles on "Careers" pages.
- **Specific Roles**: Extracts titles of key open positions (e.g., "Senior Developer", "Marketing Manager").
- **Recent News**: Captures recent press releases or blog posts.

### 2. Competitor Intelligence

The system now extracts:

- **Competitor Partnerships**: Identifies when an agency partners with competitor technologies (e.g., Klaviyo, Yotpo, Gorgias).
- **Tech Stack**: Enhanced extraction of supported platforms (Shopify, Magento, Salesforce).

## How It Works

1. **Crawling**: The system now intelligently looks for and scrapes `/careers` or `/jobs` pages.
2. **Extraction**: Updated AI schema to extract open role counts and specific competitor mentions from gathered content.
3. **Growth & Social Monitoring**: Tracks "wins" (new clients, awards) via external signals using search news and social mentions.

## Results & Demo

The missing pipeline links have been fixed! Valuations and leadership data are now successfully extracting and displaying on the dashboard.

### Dashboard Overview

The dashboard now includes an "Enrich Data" feature and new Valuation badges for better tracking.

### Partner Profiles

Partner profiles now include restored Key Leadership extraction, providing deeper insights into agency structures.
