// web/lib/note.ts
import matter from 'gray-matter';

export interface NoteFrontmatter {
  id: string;
  title: string;
  type: string;
  tags: string[];
  domain: string;
  date?: string;
  connections?: Array<{ noteId: string; score: number; type: string }>;
  x?: number;
  y?: number;
  ai_summary?: string;
}

export interface NoteContent {
  frontmatter: NoteFrontmatter;
  body: string;
}

export async function loadNote(path: string): Promise<NoteContent | null> {
  try {
    const res = await fetch(`/${path}`);
    if (!res.ok) return null;
    const text = await res.text();
    const { data, content } = matter(text);
    return {
      frontmatter: data as NoteFrontmatter,
      body: content.trim(),
    };
  } catch {
    return null;
  }
}
