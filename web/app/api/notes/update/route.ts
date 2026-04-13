// web/app/api/notes/update/route.ts
import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

export async function PATCH(req: NextRequest) {
  try {
    const { path: notePath, frontmatter } = await req.json();

    if (!notePath || !frontmatter) {
      return NextResponse.json({ error: 'Missing path or frontmatter' }, { status: 400 });
    }

    // notePath: "notes/录音笔记/uuid.md"（相对于 public/）
    const baseDir = path.resolve(process.cwd(), 'public');
    const fullPath = path.join(baseDir, notePath);

    // Prevent path traversal: ensure resolved path is within baseDir
    const resolvedPath = path.resolve(fullPath);
    if (!resolvedPath.startsWith(baseDir + path.sep)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!fs.existsSync(resolvedPath)) {
      return NextResponse.json({ error: 'Note file not found' }, { status: 404 });
    }

    const content = fs.readFileSync(resolvedPath, 'utf8');
    const bodyStart = content.indexOf('\n---\n', 4);
    if (bodyStart < 0) {
      return NextResponse.json({ error: 'Invalid markdown format' }, { status: 500 });
    }

    const body = content.slice(bodyStart + 5);
    const newFm = buildFrontmatter(frontmatter);
    const newContent = `${newFm}\n---\n${body}`;
    fs.writeFileSync(resolvedPath, '\uFEFF' + newContent, 'utf8');

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Update note error:', err);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}

function buildFrontmatter(fm: Record<string, unknown>): string {
  const lines: string[] = ['---'];
  for (const [key, value] of Object.entries(fm)) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'string') {
      lines.push(`${key}: "${value.replace(/"/g, '\\"')}"`);
    } else if (typeof value === 'number') {
      lines.push(`${key}: ${value}`);
    } else if (Array.isArray(value)) {
      const items = value.map(v => `"${String(v).replace(/"/g, '\\"')}"`).join(', ');
      lines.push(`${key}: [${items}]`);
    } else {
      lines.push(`${key}: "${String(value).replace(/"/g, '\\"')}"`);
    }
  }
  lines.push('---');
  return lines.join('\n');
}
