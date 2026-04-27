# Oh My Getnote — CLAUDE.md

## Project Overview

Oh My Getnote converts GetNote HTML exports into LLM-friendly Markdown and presents them as an interactive knowledge graph (Memex-style), inspired by Vannevar Bush's 1945 Memex vision and Andrej Karpathy's LLM-Wiki philosophy.

- **Converter** (root `/tools`): Transforms GetNote HTML → structured Markdown with LLM augmentation.
- **Web app** (`/web`): Next.js 16 knowledge graph UI at `/graph` using react-force-graph + LanceDB embeddings.
- **Monorepo**: Root-level `package.json` orchestrates both; `npm install` at root auto-installs web deps via `postinstall`.

## Environment Setup

```bash
# 1. Clone and install (root postinstall auto-runs: cd web && npm install)
git clone https://github.com/AndyZhengyan/oh-my-getnote.git
cd oh-my-getnote
npm install

# 2. Configure API keys
cp web/.env.local.example web/.env.local
# Edit web/.env.local:
#   OPENAI_API_KEY=sk-...        (required)
#   OPENAI_BASE_URL=...          (optional, e.g. OpenRouter)
```

## How to Run

```bash
# Full pipeline: convert HTML → Markdown, then start dev server
npx tsx tools/convert.ts source/ --out .   # convert GetNote HTML
cd web && npm run dev                      # → http://localhost:3000/graph
```

## npm Scripts (root package.json)

| Command | What it does |
|---|---|
| `npm run dev` | Start Next.js dev server (proxies to `web/`) |
| `npm run build` | Production build (`cd web && next build`) |
| `npm run test` | Vitest unit tests |
| `npm run test:watch` | Vitest watch mode |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run convert` | TypeScript compile + run converter |
| `npm run backfill` | Run embedding backfill script |
| `npm run test:e2e` | Playwright E2E tests (requires dev server running) |

## Git & PR Workflow

### Branch naming
`fix/<#issue>-brief-description`, `feat/<feature-name>`, `refactor/<area>`, `docs/<topic>`

### Commits
[Conventional Commits](https://www.conventionalcommits.org/) — `feat(web/graph): add node clustering`, `fix(converter): handle nested lists`

### Automated Commit → PR → Review → Merge

This project uses the `commit-commands` and `pr-review-toolkit` plugins. The full workflow is:

```
/commit-push-pr   → commit → push → create PR
                    ↓
.github/workflows/auto-review.yml   → /pr-review-toolkit:review-pr all
                    ↓
PR merged (manually or via /commit-push-pr)
/clean_gone        → clean up [gone] local branches
```

**Step-by-step slash commands to use:**

1. **Commit and push** (while on a feature branch):
   ```
   /commit-push-pr
   ```
   This creates a commit, pushes the branch, and opens a PR using `gh pr create`. The PR description is auto-generated from the branch diff and includes a test plan checklist.

2. **Automated PR review** (runs automatically via `.github/workflows/auto-review.yml`):
   The `pr-review-toolkit:review-pr all` agent runs on every PR open/sync/reopen. It posts a review comment covering: code quality, test coverage, error handling, type design, and code simplification suggestions.

3. **Cleanup after merge**:
   ```
   /clean_gone
   ```
   Removes local branches that were deleted on the remote after merge.

**CI gate** (`.github/workflows/ci.yml`):
All PRs must pass: lint → typecheck → unit tests → build → E2E tests before merge.

### Internal contributors
All of the above is handled automatically when you use `/commit-push-pr`. See `.claude/memory/commit-pr-merge-workflow.md` for details.

## Key Skills to Load

When working in this codebase, load these skills first:

```
/skill vercel-plugin:nextjs           # Next.js App Router, Server Components, routing
/skill vercel-plugin:react-best-practices  # React 19 patterns, hooks, performance
/skill superpowers:systematic-debugging    # Bug investigation before proposing fixes
/skill superpowers:verification-before-completion  # Run tests before claiming done
/skill vercel-plugin:env-vars          # Managing .env.local and Vercel env vars
```

## Project Structure

```
oh-my-getnote/
├── CLAUDE.md            ← you are here (root project context)
├── package.json         # root orchestration (postinstall auto-installs web/)
├── tools/
│   ├── convert.ts       # HTML → Markdown converter + LLM augmentation
│   └── utils.ts        # Shared converter utilities
├── web/                 # Next.js 16 web application
│   ├── app/             # App Router pages (page.tsx redirects / → /graph)
│   ├── components/      # React components
│   ├── lib/             # Server-side data loading, LanceDB logic
│   ├── stores/          # Zustand global state stores
│   ├── e2e/             # Playwright E2E tests
│   ├── vitest.config.ts # Vitest unit test config (excludes e2e/)
│   ├── .env.local.example
│   └── next.config.ts   # serverExternalPackages: ['@lancedb/lancedb', 'openai']
├── source/              # GetNote HTML export input (not in git)
└── data/                # Converted Markdown output (not in git)
```

## Tech Stack

| Layer | Technology |
|---|---|
| Web framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS v4, Framer Motion, Lucide icons |
| Graph visualization | react-force-graph-2d |
| State management | Zustand |
| Vector search | LanceDB |
| LLM integration | OpenAI SDK (also supports OpenRouter via `OPENAI_BASE_URL`) |
| Testing | Vitest (unit), Playwright (E2E) |
| TypeScript | Strict mode — no `any` escapes |

## Important Constraints

- **Next.js 16 is non-standard**: Breaking changes in APIs, conventions, and file structure. Read `node_modules/next/dist/docs/` before making assumptions. (This rule is also enforced in `web/CLAUDE.md`.)
- **serverExternalPackages**: LanceDB and OpenAI are listed in `serverExternalPackages` in `next.config.ts` — do not remove them.
- **No `any`**: TypeScript strict mode is enforced. All new code must be fully typed.
- **Tailwind v4**: Uses `@tailwindcss/postcss` — CSS classes only, no traditional `tailwind.config.js`.
- **E2E tests**: Located in `web/e2e/`, run separately with `npm run test:e2e`. Vitest excludes them via config.
