# Mission Control V3 — Agentic OS

Mission Control is Bobby's personal command center (mission-control-v3.vercel.app). This file gives subagents (Claude Code, Codex, OpenCode) the context they need to build features without re-discovering the codebase.

## Stack
- **Frontend:** Vite + React 18 (JSX, not TSX) + Tailwind + Framer Motion + Lucide icons
- **Backend:** Vercel serverless functions in `/api` (Node.js)
- **Database:** Firebase Realtime Database (workspace `workspaces/winslow_main`)
- **Auth:** Google OAuth via `src/components/Auth.jsx`
- **Package manager:** npm

## Key directories
- `src/components/` — 24 React components, lazy-loaded in `App.jsx`
- `src/lib/firebase.js` — single source of truth for Firebase RTDB refs and CRUD
- `src/App.jsx` — top-level router with 8 menu items (see below)
- `api/` — 11 Vercel serverless endpoints, all use the `module.exports = async (req, res) => Promise` pattern
- `scripts/` — Node.js + Python cron jobs and utilities (run via `node scripts/<name>.cjs` or `.js`)
- `SPEC.md` — original design spec (dark cinematic, gold/purple accents, glassmorphism)

## Current menu items in App.jsx
1. Today (dashboard)
2. Tasks (Kanban)
3. Obsidian
4. Projects
5. Content Factory
6. Clients
7. Calendar
8. Knowledge

## Firebase collections under `workspaces/winslow_main`
- `tasks` — Kanban cards
- `content` — content pipeline
- `clients` — client CRM
- `projects` — project tracking
- `knowledge` — KB articles
- `notes` — quick notes
- `obsidian` — Obsidian vault sync
- `approvalQueue` — content approval workflow (has `steps/{stepId}/artifacts` sub-schema)
- `dailyPromptDrop` — daily content drops (used for cron output)
- `agent_activity` — agent telemetry
- `agent_tasks` — subagent task queue
- `live_telemetry` — realtime events

## Cron job patterns
Two existing patterns to follow:
1. `scripts/council-cron.js` — Node.js script with `--dryRun` mode, writes to Firebase
2. `api/content-council.js` — Vercel handler that spawns the script via `execFile`, accepts POST `{mode: 'run'|'dryRun'}`

## Design system (cinematic dark)
- Background: `#050505`
- Cards: `backdrop-blur-xl` glassmorphism, `border-white/10`
- Accents: Gold `#EAB308`, Purple `#A855F7` (sparingly, for CTA/active states)
- Text: White headers, gray-400 body
- Generous padding, no clutter
- Mobile-first: safe-area-inset, bottom nav, 90vw snap-scroll cards

## Build conventions
- Branch off `main`, name `feature/<short-name>`
- All new API endpoints go in `/api/`, follow the `module.exports = async (req, res) => Promise` shape
- All new Firebase refs go in `src/lib/firebase.js` (add a new property on the `db` export)
- All new menu items go in `src/App.jsx` (lazy-load the component)
- Don't touch existing components without a clear reason — additive changes only
- Commit messages: `feat: <verb> <thing>` or `fix: <thing>`

## Existing token-tracking infra (use this for spend)
- `api/minimax-stats.js` already returns `{requests, prompts, tokensIn, tokensOut, limit, windowHours, remaining}`
- Claude spend: parse `~/.claude/projects/*/sessions/*.jsonl` for `total_cost_usd` (JSONL, line-delimited)
- Codex spend: check `~/.codex/usage` if exists

## Skills registry location
- `~/.hermes/skills/` — 70+ skills in subdirectories, each has a `SKILL.md` with YAML frontmatter
- `skill_manage` tool is the source of truth for adding/editing skills

## Deploy
- Vercel project: `mission-control-v3`
- `vercel --prod` from main branch for production
- `vercel` (no flag) for preview deploys from feature branches

## What NOT to do
- Don't refactor existing components without explicit ask
- Don't change the design system tokens
- Don't add new npm deps without justification (chart.js, framer-motion, etc. are already there — use them)
- Don't write to Firebase collections outside `workspaces/winslow_main`
- Don't break the 8 existing menu items
