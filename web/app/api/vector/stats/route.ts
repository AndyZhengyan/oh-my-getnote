// web/app/api/vector/stats/route.ts
import { NextResponse } from 'next/server';
import { noteCount } from '@/lib/lancedb';

export async function GET() {
  try {
    const count = await noteCount();
    return NextResponse.json({ count });
  } catch (err) {
    console.error('[vector/stats]', err);
    return NextResponse.json({ error: 'Failed to get stats' }, { status: 500 });
  }
}
