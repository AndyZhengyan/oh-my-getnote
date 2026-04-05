#!/usr/bin/env node
// scripts/backfill.ts
// One-shot: populate LanceDB with vectors for all existing notes.
// Run once: npx tsx scripts/backfill.ts
import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';
import { storeNote, noteExists } from '../lib/lancedb.js';
import { embedText } from '../lib/embedding.js';

const NOTES_DIR = path.resolve(process.cwd(), 'notes');

async function backfill() {
  const typeDirs = fs.readdirSync(NOTES_DIR).filter(f =>
    fs.statSync(path.join(NOTES_DIR, f)).isDirectory()
  );

  let total = 0;
  let stored = 0;
  let skipped = 0;

  for (const typeDir of typeDirs) {
    const mdFiles = fs.readdirSync(path.join(NOTES_DIR, typeDir))
      .filter(f => f.endsWith('.md'));

    for (const mdFile of mdFiles) {
      total++;
      const id = mdFile.replace(/\.md$/, '');
      const mdPath = path.join(NOTES_DIR, typeDir, mdFile);

      const exists = await noteExists(id);
      if (exists) {
        skipped++;
        continue;
      }

      const raw = fs.readFileSync(mdPath, 'utf-8');
      const { data, content } = matter(raw);

      const text = `${data.title ?? ''}\n${content.slice(0, 500)}`.trim();
      const vector = await embedText(text);

      await storeNote({
        id,
        title: data.title ?? '',
        type: data.type ?? typeDir,
        text,
        vector,
      });
      stored++;
      process.stdout.write(`\r   ${stored} stored, ${skipped} skipped`);
    }
  }
  console.log(`\n✅ 完成：新增 ${stored} 篇，跳过 ${skipped} 篇`);
}

backfill().catch(err => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
