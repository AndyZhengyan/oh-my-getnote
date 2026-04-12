// web/lib/api.ts

export interface TagNode {
  label: string;
  count: number;
  tagCount: number;
  children?: TagNode[];
}

export interface NoteIndexEntry {
  path: string;
  domain: string;
  type: string;
  title: string;
  tagTree: string[];
  connections: Array<{ noteId: string; score: number; type: string }>;
}

export interface GraphIndex {
  version: string;
  generated_at: string;
  domains: string[];
  index: Record<string, NoteIndexEntry>;
  stats: {
    total_notes: number;
    total_connections: number;
    by_domain: Record<string, number>;
    by_type: Record<string, number>;
    by_tagTree: Record<string, number>;
    tagTree: TagNode[];
  };
}

export async function loadGraphIndex(): Promise<GraphIndex> {
  const res = await fetch('/graph-index.json');
  if (!res.ok) throw new Error(`Failed to load graph-index.json: ${res.status}`);
  return res.json();
}
