// web/lib/embedding.ts — API route wrapper around linker embedding
// Resolves linker relative to this file: web/lib/linker/semantic.js

import { embedNotes } from './linker/semantic.js';

export async function embedText(text: string): Promise<number[]> {
  const note = { id: 'temp', title: '', contentSnippet: text };
  const map = await embedNotes([note]);
  return map.get('temp') || [];
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const notes = texts.map((t, i) => ({ id: `tmp-${i}`, title: '', contentSnippet: t }));
  const map = await embedNotes(notes);
  return notes.map(n => map.get(n.id) || []);
}
