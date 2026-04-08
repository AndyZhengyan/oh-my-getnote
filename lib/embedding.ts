// lib/embedding.ts
// Reuses embedNotes from linker/semantic.js (copied into lib/linker/ during build)
// Types declared in linker/semantic.d.ts

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
