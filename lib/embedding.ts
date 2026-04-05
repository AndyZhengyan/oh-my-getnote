// lib/embedding.ts
// Reuses embedNotes from dist/linker/semantic.js (the single embedding implementation)
// dist/ is compiled output — no TypeScript source exists for this module

// @ts-ignore — dist has no .d.ts
import { embedNotes } from '../dist/linker/semantic.js';

export async function embedText(text: string): Promise<number[]> {
  const results = await embedNotes([text]);
  return results.get(text) || [];
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const results = await embedNotes(texts);
  return texts.map((t) => results.get(t) || []);
}
