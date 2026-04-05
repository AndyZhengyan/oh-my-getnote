// web/app/api/vector/search/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { searchVectors } from '@/lib/lancedb';
import { embedText } from '@/lib/embedding';

export async function POST(req: NextRequest) {
  try {
    const { texts, limit = 10, excludeIds = [] } = await req.json();

    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return NextResponse.json({ error: 'texts array is required' }, { status: 400 });
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
