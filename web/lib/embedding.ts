// web/lib/embedding.ts
// Reuses embedNotes from dist/linker/semantic.js (the single embedding implementation)
// dist/ is compiled output — no TypeScript source exists for this module

// @ts-ignore — dist has no .d.ts
import { embedNotes } from '../../dist/linker/semantic.js';

// embedNotes returns Map<id, number[]> and expects { id, title, contentSnippet }
export async function embedText(text: string): Promise<number[]> {
  const map = await embedNotes([{ id: '_', title: '', contentSnippet: text }]);
  return map.get('_') ?? [];
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const notes = texts.map((t, i) => ({ id: String(i), title: '', contentSnippet: t }));
  const map = await embedNotes(notes);
  return notes.map(n => map.get(n.id) ?? []);
}
