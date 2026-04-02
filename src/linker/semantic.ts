import OpenAI from 'openai';
import type { Note, GraphLink, NoteConnection } from '../types.js';

// OpenRouter embedding via google/gemini-embedding-001
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? 'sk-or-v1-placeholder';
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL ?? 'https://openrouter.ai/api/v1';
const EMBEDDING_MODEL = 'google/gemini-embedding-001';

const client = new OpenAI({
  apiKey: OPENAI_API_KEY,
  baseURL: OPENAI_BASE_URL,
});

/**
 * Embed a batch of texts via OpenRouter API.
 * Returns an array of embedding vectors (same order as input).
 */
async function embedBatch(texts: string[]): Promise<number[][]> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is not set. Set it before running the converter.');
  }
  // Truncate each text to 2048 chars (gemini-embedding-001 limit)
  const inputs = texts.map(t => t.slice(0, 2048));
  const resp = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: inputs,
  });
  if (!resp || !resp.data) {
    throw new Error(`Embedding API returned invalid response: ${JSON.stringify(resp).slice(0, 200)}`);
  }
  return resp.data.map(d => d.embedding);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-10);
}

export async function embedNotes(notes: Note[]): Promise<Map<string, number[]>> {
  if (notes.length === 0) return new Map();

  const BATCH_SIZE = 50;   // safe batch size for gemini-embedding-001 on OpenRouter
  const map = new Map<string, number[]>();

  for (let i = 0; i < notes.length; i += BATCH_SIZE) {
    const chunk = notes.slice(i, i + BATCH_SIZE);
    const texts = chunk.map(n => `${n.title} ${n.contentSnippet}`.trim());
    if (i === 0) {
      console.log(`   Embedding ${notes.length} notes in batches of ${BATCH_SIZE}...`);
    }
    const vectors = await embedBatch(texts);
    vectors.forEach((vec, j) => map.set(chunk[j].id, vec));
    const done = Math.min(i + BATCH_SIZE, notes.length);
    process.stdout.write(`\r   Progress: ${done}/${notes.length} notes embedded`);
    if (i + BATCH_SIZE < notes.length) {
      await new Promise(r => setTimeout(r, 200)); // avoid rate limit
    }
  }
  console.log(); // newline after progress

  return map;
}

export async function buildSemanticLinks(
  notes: Note[],
  threshold = 0.75,
): Promise<GraphLink[]> {
  if (notes.length < 2) return [];
  const embeddings = await embedNotes(notes);
  const ids = Array.from(embeddings.keys());
  const links: GraphLink[] = [];

  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const sim = cosineSimilarity(embeddings.get(ids[i])!, embeddings.get(ids[j])!);
      if (sim >= threshold) {
        links.push({ source: ids[i], target: ids[j], type: 'semantic', weight: sim });
      }
    }
  }
  return links;
}

/**
 * 计算每个笔记的 Top-K 最相似邻居
 * @param notes  笔记列表
 * @param threshold  相似度阈值（默认 0.5，让更多边出现）
 * @param topK  每个节点保留的最相似邻居数量（默认 8）
 * @param returnEmbeddings  如果为 true，同时返回 embeddings map（共 PCA 使用）
 */
export async function buildNoteConnections(
  notes: Note[],
  threshold = 0.5,
  topK = 8,
  returnEmbeddings = false,
): Promise<Map<string, NoteConnection[]> | { connections: Map<string, NoteConnection[]>; embeddings: Map<string, number[]> }> {
  if (notes.length < 2) {
    return returnEmbeddings ? { connections: new Map(), embeddings: new Map() } : new Map();
  }

  const embeddings = await embedNotes(notes);
  const ids = Array.from(embeddings.keys());
  const result = new Map<string, NoteConnection[]>();

  for (let i = 0; i < ids.length; i++) {
    const sims: NoteConnection[] = [];
    for (let j = 0; j < ids.length; j++) {
      if (i === j) continue;
      const sim = cosineSimilarity(embeddings.get(ids[i])!, embeddings.get(ids[j])!);
      if (sim >= threshold) {
        sims.push({ noteId: ids[j], score: sim });
      }
    }
    // 按相似度降序，取 topK
    sims.sort((a, b) => b.score - a.score);
    result.set(ids[i], sims.slice(0, topK));
  }

  return returnEmbeddings ? { connections: result, embeddings } : result;
}
