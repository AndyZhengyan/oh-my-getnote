# Memex for Getnote

> Your notes as a living graph of connected ideas — powered by AI.

A self-hosted knowledge graph that turns markdown notes into an interactive, searchable graph. Click nodes, trace paths, ask AI — all locally.

```
notes/                         web/
  *.md ──────► backfill ──► LanceDB vector store
                                   │
                          Next.js graph UI
                                   │
                          ┌────────▼────────┐
                          │  Force-directed  │
                          │      graph       │
                          └─────────────────┘
```

## Install

```bash
git clone https://github.com/AndyZhengyan/memex-for-getnote.git
cd memex-for-getnote

npm install && cd web && npm install && cd ..

cp web/.env.local.example web/.env.local
# Add your OPENAI_API_KEY (or OpenRouter key)
```

## Quick Start

```bash
cd web && npm run dev
# Open http://localhost:3000/graph
```

## Highlights

- **Force-directed graph** — visualize notes as nodes, connections as edges
- **Domain & type filtering** — narrow the graph to specific categories
- **Keyword search** — instant full-text search across all notes
- **AI summaries** — hover/click a node, get an OpenAI-generated summary
- **Multi-hop vector search** — find indirect relationships through semantic similarity
- **Browse path tracing** — click nodes to build and save exploration paths

## Adding Notes

Drop a markdown file in `notes/` with frontmatter:

```markdown
---
title: My Note
domain: AI 核心技术与模型
type: 论文笔记
---

Content goes here...
```

Then run:

```bash
npm run backfill
```

## Architecture

```
notes/*.md          Raw markdown source
  └── scripts/backfill.ts    Parse + vectorize
        └── LanceDB          Vector similarity engine
              └── web/app/graph/page.tsx   Next.js UI
                    └── react-force-graph-2d   Graph canvas
```

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| State | Zustand |
| Graph | react-force-graph-2d |
| AI | OpenAI SDK / OpenRouter |
| Vectors | LanceDB |
| Tests | Vitest + Playwright |

## Run Tests

```bash
npm test              # unit tests
cd web && npx playwright test   # e2e tests
```

## License

MIT © Andy Zhengyan
