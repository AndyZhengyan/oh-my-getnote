# Memex for Getnote

A knowledge graph application that turns your markdown notes into an interactive, searchable, and AI-powered graph of connected ideas.

[Explore the Demo](http://localhost:3000/graph) · [Documentation](web/README.md)

## Key Features

- **Interactive Knowledge Graph** — Force-directed graph visualization of your notes
- **Domain & Type Filtering** — Focus on specific categories and node types
- **Keyword Search** — Instant search across all markdown files
- **AI-Generated Summaries** — OpenAI/OpenRouter powered context at a glance
- **Multi-Hop Vector Search** — Discover indirect relationships through vector similarity
- **Browse Path Tracing** — Trace and save paths through connected notes

## Quick Start

```bash
git clone https://github.com/AndyZhengyan/memex-for-getnote.git
cd memex-for-getnote

# Install dependencies
npm install
cd web && npm install && cd ..

# Set up environment
cp web/.env.local.example web/.env.local
# Then edit web/.env.local with your API key

# Run
cd web && npm run dev
```

Open [http://localhost:3000/graph](http://localhost:3000/graph)

## Tech Stack

Next.js 16 · TypeScript · Tailwind CSS · Zustand · react-force-graph-2d · LanceDB · OpenAI SDK

## License

MIT © Andy Zhengyan
