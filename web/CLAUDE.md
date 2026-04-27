<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Web App — Project-Specific Rules

This file supplements the root `CLAUDE.md`. Everything there applies here too.

### Key Routes

| Route | Purpose |
|---|---|
| `/` | Redirects to `/graph` |
| `/graph` | Main knowledge graph view (react-force-graph canvas + sidebar panel) |

All pages live in `web/app/` using the Next.js App Router.

### TypeScript Conventions

- Strict mode — no `any`, no `// @ts-ignore` escapes.
- Prefer explicit return types on exported functions.
- Use `import type` for type-only imports.
- `serverExternalPackages: ['@lancedb/lancedb', 'openai']` in `next.config.ts` — these packages run server-side only.

### Component Patterns

- Functional components with hooks only (no class components).
- Keep components small and focused; extract logic into custom hooks.
- Use Zustand for cross-component shared state (`web/stores/`).
- Use `camelCase` for variables/functions, `PascalCase` for React components, `kebab-case` for file names.
- Tailwind CSS v4 via `@tailwindcss/postcss` — use utility classes only; no `tailwind.config.js`.

### State Management (Zustand)

```
web/stores/
├── graphStore.ts      # Graph layout, node selection, camera
├── panelStore.ts      # Sidebar/panel open state
└── ...
```

Only promote state to Zustand when it genuinely needs to be shared across components. Local `useState`/`useRef` is fine for component-local UI concerns.

### Data Fetching

- Server-side data loading: use `lib/` modules directly in Server Components.
- Do not call LanceDB or OpenAI from Client Components unless through a Server Action or Route Handler.
- The `openai` package and `@lancedb/lancedb` are externalized via `serverExternalPackages` — they cannot be bundled for the browser.

### Testing

- **Unit tests**: Vitest, config in `vitest.config.ts`, setup in `vitest.setup.ts`. Test files live alongside source: `stores/*.test.ts`, `lib/*.test.ts`.
- **E2E tests**: Playwright, in `web/e2e/`. Run with `npm run test:e2e` (requires dev server).
- Vitest config excludes `e2e/` from unit test runs.

### Environment Variables

Copy `web/.env.local.example` → `web/.env.local`.

```env
OPENAI_API_KEY=sk-...       # required
OPENAI_BASE_URL=...         # optional, e.g. https://openrouter.ai/api/v1
```

Never commit `.env.local` — it is gitignored.

### Available npm Scripts

```bash
npm run dev          # next dev
npm run build        # next build
npm run start        # next start (production)
npm run lint         # eslint
npm run test         # vitest run
npm run test:watch   # vitest (watch mode)
npm run typecheck    # tsc --noEmit
npm run test:e2e     # playwright test (dev server must be running)
```
