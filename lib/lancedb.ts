// lib/lancedb.ts
import { connect, Index, type Connection, type Table } from '@lancedb/lancedb';
import * as path from 'path';

// LanceDB data lives under data/lancedb/, already excluded by .gitignore
const DB_PATH = path.resolve(process.cwd(), 'data', 'lancedb', 'notes.lancedb');
const TABLE_NAME = 'notes';

let db: Connection | null = null;
let table: Table | null = null;
let initPromise: Promise<Table> | null = null;

const UUID_REGEX = /^[a-f0-9-]+$/i;

async function getTable(): Promise<Table> {
  if (table) return table;
  if (!initPromise) {
    initPromise = (async () => {
      db = await connect(DB_PATH);
      const tables = await db.tableNames();
      if (tables.includes(TABLE_NAME)) {
        table = await db.openTable(TABLE_NAME);
      } else {
        table = await db.createTable(TABLE_NAME, [
          {
            id: '__init__',
            title: '',
            type: '',
            text: '',
            vector: new Float32Array(768),
            createdAt: 0,
          },
        ]);
        await table.delete('id = "__init__"');
        try {
          await table.createIndex('vector', { config: Index.ivfFlat({ distanceType: 'cosine' }) });
        } catch {
          // Index creation may fail on fresh DB with no data — table still usable
        }
      }
      return table;
    })();
  }
  return initPromise;
}

export interface NoteVector {
  id: string;
  title: string;
  type: string;
  text: string;
  vector: number[];
  createdAt?: number;
}

/** Store a single note vector. Idempotent (can be called repeatedly for same id). */
export async function storeNote(note: NoteVector): Promise<void> {
  if (!UUID_REGEX.test(note.id)) throw new Error(`Invalid note id: ${note.id}`);
  const t = await getTable();
  // Idempotent: delete existing row if present, then add
  const exists = await noteExists(note.id);
  if (exists) {
    await t.delete(`id = '${note.id.replace(/'/g, "''")}'`);
  }
  await t.add([{
    ...note,
    vector: new Float32Array(note.vector),
    createdAt: note.createdAt ?? Date.now(),
  }]);
}

/** Search by vector, optionally excluding some ids (e.g. notes already in the current path). */
export async function searchVectors(
  queryVector: number[],
  limit: number = 10,
  excludeIds?: string[],
): Promise<Array<{ id: string; title: string; type: string; text: string; score: number }>> {
  const t = await getTable();
  const maxResults = limit + (excludeIds?.length ?? 0);
  const results = await t
    .vectorSearch(new Float32Array(queryVector))
    .limit(maxResults)
    .toArray();

  const filtered = excludeIds?.length
    ? results.filter(r => !excludeIds.includes(r.id as string))
    : results;

  return filtered.slice(0, limit).map(row => ({
    id: row.id as string,
    title: row.title as string,
    type: row.type as string,
    text: row.text as string,
    // LanceDB default L2 distance → approximate cosine similarity
    score: 1 / (1 + ((row._distance as number) ?? 0)),
  }));
}

/** Total count of stored note vectors. */
export async function noteCount(): Promise<number> {
  const t = await getTable();
  return t.countRows();
}

/** Check whether a note id already exists in the store. */
export async function noteExists(id: string): Promise<boolean> {
  if (!UUID_REGEX.test(id)) return false;
  const t = await getTable();
  const results = await t.query().where(`id = '${id.replace(/'/g, "''")}'`).limit(1).toArray();
  return results.length > 0;
}
