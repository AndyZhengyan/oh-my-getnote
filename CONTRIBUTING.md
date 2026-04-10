# Contributing to oh-my-getnote

Thank you for your interest in contributing to Memex for Getnote — a knowledge graph application that helps you explore and understand your notes as an interactive graph.

## Welcome

We welcome contributions of all kinds: bug fixes, feature improvements, documentation, and tests. Before diving in, please check the [issue tracker](https://github.com/AndyZhengyan/oh-my-getnote/issues) to see what's already being worked on.

## Code of Conduct

All contributors are expected to follow our [Code of Conduct](./CODE_OF_CONDUCT.md). Please read it before participating in this project.

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/AndyZhengyan/oh-my-getnote.git
   cd oh-my-getnote
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env.local
   ```
   Open `.env.local` and fill in the required values. See `.env.example` for available options (API keys, data paths, etc.).

## Development Workflow

### Running the Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:3000`.

### Running Tests

```bash
# Unit tests
npm test

# End-to-end tests (requires dev server running)
npm run e2e
```

## Project Structure

```
oh-my-getnote/
├── web/               # Next.js frontend
│   ├── app/           # Next.js App Router pages
│   ├── components/    # React components
│   ├── stores/        # Zustand state stores
│   └── e2e/           # Playwright end-to-end tests
├── notes/             # Markdown note source files
└── lib/               # Root-level data loading and utility scripts
```

- **`web/`** — The main Next.js application. All UI, routing, and client-side logic live here.
- **`notes/`** — Plain markdown files that serve as the note source. The graph is built from these files.
- **`web/e2e/`** — Playwright tests that verify end-to-end behavior in a real browser.
- **`web/components/`** — Reusable React components (canvas, panels, graph visualizations, etc.).
- **`web/stores/`** — Zustand stores managing application state (selected note, graph layout, UI panels, etc.).
- **`lib/`** — Standalone scripts for loading and transforming note data, typically run as part of the build or data pipeline.

## Making Changes

### Branch Naming

Use a descriptive prefix followed by a short descriptor:

- `fix/<issue-number>-brief-description`
- `feat/<feature-name>`
- `refactor/<area-of-change>`
- `docs/<topic>`

### Commit Style

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(graph): add multi-hop path highlighting
fix(canvas): correct node positioning on resize
refactor(stores): consolidate selection state
docs(readme): update installation instructions
```

Format: `<type>(<scope>): <description>` — use imperative mood, keep the subject line under 72 characters.

### Pull Requests

1. Fork the repository and create your branch from `main`.
2. Ensure all tests pass and there are no linting errors.
3. Fill out the PR description — explain **what** changed and **why**.
4. Link any related issues (e.g., "Fixes #42").

## Reporting Bugs

Found a bug? Please open a [GitHub Issue](https://github.com/AndyZhengyan/oh-my-getnote/issues). Include the following to help us reproduce and fix it:

- A clear, descriptive title
- Steps to reproduce the issue
- Expected vs. actual behavior
- Browser and OS version
- Any relevant error messages or screenshots

## Suggesting Features

We'd love to hear your ideas. Open a [GitHub Discussion](https://github.com/AndyZhengyan/oh-my-getnote/discussions) or create an issue labeled `enhancement`. Please describe:

- The problem you are trying to solve
- How you envision the feature working
- Any alternatives you have considered

## Code Style

- **TypeScript** — Strict mode is enabled. All new code must be type-safe with no `any` escapes.
- **Styling** — Use Tailwind CSS utility classes for all UI styling. Avoid inline styles or ad-hoc CSS files.
- **Components** — Prefer functional components with hooks. Keep components small and focused; extract logic into custom hooks when appropriate.
- **State** — Use Zustand for global client state. Local component state (useState, useRef) is fine for UI-only concerns.
- **Naming** — Use `camelCase` for variables and functions, `PascalCase` for React components, and `kebab-case` for file names.

## Questions?

If you have questions that are not answered here, feel free to open a discussion or reach out via the issue tracker. We aim to respond within a few days.
