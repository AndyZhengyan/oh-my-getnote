// web/app/api/source/[...path]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.htm': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.txt': 'text/plain',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path: pathParts } = await context.params;
  // source/ is at the project root, one level up from the Next.js web/ directory
  const filePath = path.join(process.cwd(), '..', 'source', ...pathParts);

  if (!fs.existsSync(filePath)) {
    return new NextResponse('Not found', { status: 404 });
  }

  const stat = fs.statSync(filePath);
  if (stat.isDirectory()) {
    return new NextResponse('Not found', { status: 404 });
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = CONTENT_TYPES[ext] ?? 'application/octet-stream';

  try {
    const content = fs.readFileSync(filePath);
    return new NextResponse(content, {
      status: 200,
      headers: { 'Content-Type': contentType },
    });
  } catch {
    return new NextResponse('Internal server error', { status: 500 });
  }
}
