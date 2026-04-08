// Type declarations for dist/linker/semantic.js (compiled output — no source .ts)

export interface EmbedNote {
  id: string;
  title: string;
  contentSnippet: string;
}

/** Embed a batch of notes; returns a map from note id → embedding vector. */
export function embedNotes(notes: EmbedNote[]): Promise<Map<string, number[]>>;

export function cosineSimilarity(a: number[], b: number[]): number;

export async function buildSemanticLinks(
  notes: EmbedNote[],
  threshold?: number,
  topK?: number,
  verbose?: boolean,
): Promise<Array<{ noteId: string; connections: Array<{ noteId: string; score: number }> }>>;

export async function buildNoteConnections(
  notes: EmbedNote[],
  threshold?: number,
  topK?: number,
  verbose?: boolean,
): Promise<{
  connections: Map<string, Array<{ noteId: string; score: number }>>;
  embeddings: Map<string, number[]>;
}>;
