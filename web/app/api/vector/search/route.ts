// web/app/api/vector/search/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { searchVectors } from '@lib/lancedb';
import { embedText } from '@lib/embedding';

export async function POST(req: NextRequest) {
  try {
    const { texts, limit = 10, excludeIds = [] } = await req.json();

    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return NextResponse.json({ error: 'texts array is required' }, { status: 400 });
    }

    const totalChars = texts.reduce((sum: number, t: string) => sum + (typeof t === 'string' ? t.length : 0), 0);
    if (texts.length > 20) {
      return NextResponse.json({ error: 'Too many notes (max 20)' }, { status: 400 });
    }
    if (totalChars > 200000) {
      return NextResponse.json({ error: 'Total text too long (max 200KB)' }, { status: 400 });
    }

    // Combine selected notes into one query
    const queryText = texts.join('\n---\n');
    const vector = await embedText(queryText);
    const results = await searchVectors(vector, limit, excludeIds);

    return NextResponse.json({ results });
  } catch (err) {
    console.error('[vector/search]', err);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
