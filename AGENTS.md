# Athos Commerce - Context

## Project Overview
This directory contains the codebase for the **Athos Commerce** platform, split into two distinct React applications.

## Sub-Projects

### 1. Display (`/Display`)
- **Purpose**: Likely the customer-facing frontend or dashboard.
- **Stack**: Vite, React, TypeScript, Tailwind CSS, Supabase.
- **Package Manager**: Bun

### 2. Research (`/Research`)
- **Purpose**: Internal tool or data analysis interface (Agency Analyzer MVP).
- **Stack**: Vite, React, TypeScript, Tailwind CSS.
- **Package Manager**: Bun

## Key Commands
Since this is a multi-root workspace, run commands inside the specific sub-folder.

### For `Display`:
```bash
cd Display
bun install
bun run dev
bun run build
```

### For `Research`:
```bash
cd Research
bun install
bun run dev
bun run build
```

## Shared Context
- Both projects use **Vite** for fast development.
- **Bun** is the preferred runtime/package manager (indicated by `bun.lockb`).
- **Supabase** is used in `Display` for backend services.
