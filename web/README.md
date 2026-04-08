# Oh My Getnote

A knowledge graph application that turns your markdown notes into an interactive, searchable, and AI-powered graph of connected ideas.

## Key Features

- **Interactive Knowledge Graph** — Visualize notes as nodes in a force-directed graph. Explore connections by clicking, dragging, and zooming.
- **Domain & Type Filtering** — Filter the graph by domain (e.g. tech, science, life) and node type (idea, project, reference) to focus on what matters.
- **Keyword Search** — Instantly find notes by keyword across all your markdown files.
- **AI-Generated Summaries** — Each node displays an AI-generated summary powered by OpenAI or OpenRouter, giving you instant context without opening a file.
- **Multi-Hop Vector Search** — Discover related notes through vector similarity, including multi-hop connections that surface indirect relationships.
- **Browse Path Tracing** — Trace the exact path of how two notes are connected through the graph.
- **Saved Trails** — Bookmark and revisit paths through the graph to keep track of your thinking.

## Architecture Overview

```
my-getnote-kg/
├── notes/               # Markdown source files (your notes live here)
├── scripts/
│   └── backfill.ts      # Backfills LanceDB vector store from notes/
├── web/                 # Next.js 16 application
│   ├── app/
│   │   └── graph/
│   │       └── page.tsx # Main knowledge graph page
│   ├── e2e/             # Playwright end-to-end tests
│   └── .env.local.example
└── package.json         # Root scripts: backfill, build, lint, test
```

Notes are stored as markdown files in `notes/` at the project root. The root `backfill` script parses these files and ingests them into a LanceDB vector store. The Next.js app reads the markdown files and vector store at runtime.

## Prerequisites

- **Node.js** 18 or later
- **OpenAI API key** or an **OpenRouter** API key (for AI features)

## Installation

1. Clone the repository and install dependencies for the root project and the web app:

```bash
# Install root dependencies (LanceDB, backfill tooling)
npm install

# Install Next.js app dependencies
cd web && npm install && cd ..
```

2. Copy the environment variables template and fill in your credentials:

```bash
cp web/.env.local.example web/.env.local
```

3. Edit `web/.env.local` and set your API key:

```env
OPENAI_API_KEY=your-api-key-here
OPENAI_BASE_URL=https://openrouter.ai/api/v1   # optional, for OpenRouter
```

## Adding New Notes

Create a new markdown file in the `notes/` directory at the project root. The file should include frontmatter with at least a `title` field:

```markdown
---
title: My New Note
domain: tech
type: idea
---

This is the content of my note. It will automatically appear in the graph.
```

Supported frontmatter fields:

| Field | Description |
|---|---|
| `title` | Display name of the node (required) |
| `domain` | Category for domain filtering (e.g. tech, science, life) |
| `type` | Node type for type filtering (e.g. idea, project, reference) |

After adding or editing notes, run the backfill script to update the vector store:

```bash
npm run backfill
```

## Running the Development Server

From the `web/` directory:

```bash
cd web
npm run dev
```

Then open [http://localhost:3000/graph](http://localhost:3000/graph) in your browser.

## Running Tests

### End-to-End Tests (Playwright)

```bash
cd web
npx playwright install
npm run test:e2e
```

### Unit Tests (Vitest)

```bash
npm test
```

## Tech Stack

- **Framework** — Next.js 16 (App Router)
- **Language** — TypeScript
- **Styling** — Tailwind CSS v4
- **State Management** — Zustand
- **Graph Visualization** — react-force-graph-2d
- **Markdown Rendering** — react-markdown + remark-gfm
- **AI Integration** — OpenAI SDK (compatible with OpenRouter)
- **Vector Search** — LanceDB
- **E2E Testing** — Playwright
