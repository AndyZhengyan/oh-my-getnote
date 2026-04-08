# Memex for Getnote

> _"The human mind does not work that way. It operates by association."_ — Vannevar Bush, 1945

In 1945, Vannevar Bush imagined a machine called **Memex** — where every piece of knowledge would be linked to others by a trail of associations, so the mind could explore ideas not in a rigid hierarchy, but along the paths of its own thinking.

Seventy-five years later, we built it.

---

**Memex for Getnote** turns your [GetNote](https://www.biji.com) notes into an interactive knowledge graph. Follow trails of association. Let the connections surprise you.

---

## From GetNote to Knowledge Graph in 3 Steps

```
GetNote (www.biji.com)
    │
    │ ① Export as HTML
    ▼
source/*.html
    │
    │ ② Run the converter
    │ npx tsx tools/convert.ts <source-dir> [--out .]
    ▼
notes/*.md         graph-index.json
(Obsidian-style)   (graph connections)
    │
    │ ③ Launch the graph
    │ cd web && npm run dev
    ▼
  📊 知识图谱
  AI 推荐 · 探索轨迹 · 深度发现
```

---

## What You Get

**AI 智能推荐**  
Click any node — AI recommends the most related notes, surfacing connections you didn't know existed.

**探索轨迹**  
Your click path is recorded as a trail of footsteps. Revisit your thinking later. Share the path with others.

**向量多跳搜索**  
Not just direct neighbors. Find associations two or three hops away — the indirect links that make an idea network powerful.

**知识过滤**  
Filter the graph by domain and type. Focus on one topic at a time, then follow the thread wherever it leads.

---

## For GetNote Users

Your notes on [GetNote](https://www.biji.com) hold years of accumulated knowledge — but scattered across HTML files, connections invisible, context lost. **Memex for Getnote** transforms them into a living graph where relationships emerge naturally, not through rigid folders.

---

## Quick Start

```bash
# 1. Export from GetNote → save as HTML to source/
#    (GetNote → Settings → Export → HTML)

# 2. Install
npm install && cd web && npm install && cd ..

# 3. Set up environment
cp web/.env.local.example web/.env.local
# Add your OPENAI_API_KEY (OpenAI or OpenRouter)

# 4. Convert notes
npx tsx tools/convert.ts source/ --out .

# 5. Launch
cd web && npm run dev
# → Open http://localhost:3000/graph
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Graph | react-force-graph-2d |
| AI | OpenAI SDK / OpenRouter |
| Vectors | LanceDB |
| Tests | Vitest + Playwright |

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) · [Code of Conduct](CODE_OF_CONDUCT.md)

## License

MIT © Andy Zhengyan
