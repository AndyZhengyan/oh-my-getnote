// lib/embedding.ts
// Reuses embedBatch from dist/linker/semantic.js (the single embedding implementation)
// dist/ is compiled output — no TypeScript source exists for this module

// @ts-ignore — dist has no .d.ts
import { embedBatch } from '../dist/linker/semantic.js';

export async function embedText(text: string): Promise<number[]> {
  const results = await embedBatch([text]);
  return results[0];
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  return embedBatch(texts);
}
