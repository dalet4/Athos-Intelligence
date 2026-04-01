# Procedural Skills Memory

This file defines standard operating procedures (SOPs) and recurring workflows to ensure consistency across tasks.

## 🛠️ General Development Workflows

### 📦 New Feature Implementation
1.  **Plan**: create an `implementation_plan.md` using the standard template.
2.  **Verify**: Ensure no existing code conflicts.
3.  **Implement**: Write code following specific stack guidelines below.
4.  **Preflight**: ALWAYS run `npm run preflight` before requesting review.

### 🐛 Bug Fix
1.  **Reproduce**: Create a reproduction test case (if possible) or script.
2.  **Fix**: Apply fix.
3.  **Verify**: Run the specific test case AND `npm run preflight` to ensure no regressions.

---

## 💻 Stack-Specific Skills

### ⚛️ Next.js & React
**Context**: Used for `Aigentic Website`.
**Rules**:
-   **Components**: Use Functional Components + Hooks.
-   **Styling**: pure Tailwind CSS (no arbitrary values if possible).
-   **State**: Lift state up; use `useReducer` for complex state.
-   **Performance**: Server Components by default; `use client` only for interactivity.

**Template: New Component**
```tsx
import { FC } from 'react';

interface ComponentProps {
  label: string;
}

export const ComponentName: FC<ComponentProps> = ({ label }) => {
  return (
    <div className="p-4 rounded-lg bg-surface-100">
      <span className="text-secondary-900">{label}</span>
    </div>
  );
};
```

### 🕸️ n8n Automation
**Context**: Used for `Lead Generation` and `LinkedIn Automation`.
**Rules**:
-   **Naming**: `PascalCase` for workflow files (e.g., `LeadScraper_v1.n8n.json`).
-   **Code Nodes**: Use standard JS (ES6+); prefer `Array.map` over loops.
-   **Credentials**: NEVER hardcode. Use n8n credential store or `env` vars.
-   **Testing**: Trigger via webhooks using `curl` payloads stored in `samples/`.

### ⚡ Supabase & Edge Functions
**Context**: Used for `Support Warehouse Lead Generation`.
**Rules**:
-   **Linting**: Run `deno lint <file>` before deploy.
-   **Testing**: Run `deno run --allow-env --allow-net <file>` for local smoke tests.
-   **Database**: use `plpgSQL` for complex logic; keep RLS enabled.

---

## 🤖 Agent Capabilities

### 🌲 Using Pinecone (Vector DB)
**Goal**: Retrieve context or memories.
1.  Ensure `PINECONE_API_KEY` is active.
2.  Use `pinecone` MCP tool to `search` or `query`.
3.  Always `describe_index_stats` first to understand namespaces.

### 🔎 Advanced Research
**Goal**: Multi-step deep dive.
1.  Use `sequentialThinking` to plan the research path.
2.  Use `everything` (browser) or `search_web` to gather raw data.
3.  Synthesize findings in a markdown artifact.

---

## 🚀 Superpowers (Master Skills Library)

I have created a centralized **Master Skills Library** containing specialized agent workflows.

**Location:** `~/Documents/Antigravity_Agent_Skills_Master` (or `Antigravity_Agent_Skills_Master/` in your artifacts).

### How to Import
1.  Run the installer script: `./install_skill.sh <skill-name> <project-path>`
2.  Or copy the folder from `skills/` to your project's `.agent/skills/`.

### Available Skills
-   **`brand-identity`**: Design tokens and voice/tone guidelines.
-   **`error-handling-patterns`**: Robust patterns (Circuit Breaker, Result types).
-   **`systematic-debugging`**: Root cause analysis workflow.
-   **`writing-plans`** & **`executing-plans`**: Step-by-step implementation.
-   **`test-driven-development`**: Red-Green-Refactor loop.
-   **`verification-before-completion`**: Strict done definitions.
-   **`brainstorming`**: Collaborative design.
