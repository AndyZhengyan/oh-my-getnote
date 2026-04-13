// tools/utils.ts
// Reusable utilities for the conversion process

import * as fs from 'fs';
import * as path from 'path';

/**
 * Extracts tags from HTML content.
 */
export function extractTags(html: string): string[] {
  const matches = [...html.matchAll(/<span class=["']tag["'][^>]*>([\s\S]*?)<\/span>/gi)];
  return matches
    .map(m => m[1].replace(/<[^>]+>/g, '').trim())
    .filter(t => t.length > 0 && t.toLowerCase() !== 'null');
}

/**
 * Fix HTML image paths: rewrite relative `files/xxx` to `../files/xxx`
 * so they resolve correctly when HTML is served from the notes/ directory.
 */
export function fixHtmlImagePaths(html: string): string {
  // Replace src="files/xxx" with src="../files/xxx"
  return html.replace(/src=["']files\//g, 'src="../files/');
}

/**
 * Copies images referenced in HTML from source to target directory.
 */
export function copyImages(
  html: string,
  sourceNotesDir: string,
  targetImageDir: string,
): void {
  fs.mkdirSync(targetImageDir, { recursive: true });
  const imgMatches = [...html.matchAll(/src=["']([^"']+)["']/gi)];
  for (const m of imgMatches) {
    const src = m[1];
    if (src.startsWith('http')) continue;

    let srcPath = path.join(sourceNotesDir, src);
    let fname = path.basename(srcPath);

    // If the file doesn't exist, search for it by hash (filename without extension)
    if (!fs.existsSync(srcPath)) {
      const filesDir = path.join(sourceNotesDir, 'files');
      if (fs.existsSync(filesDir)) {
        const files = fs.readdirSync(filesDir);
        const hash = path.basename(src);
        const match = files.find(f => f.startsWith(hash));
        if (match) {
          srcPath = path.join(filesDir, match);
          fname = match;
        }
      }
    }

    if (fs.existsSync(srcPath)) {
      try {
        fs.copyFileSync(srcPath, path.join(targetImageDir, fname));
      } catch {
        // 单个图片复制失败不影响整体流程
      }
    }
  }
}
