// web/app/api/vector/store/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { storeNote } from '@/lib/lancedb';
import { embedText } from '@/lib/embedding';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, title, type, text } = body;

    if (!id || !text) {
      return NextResponse.json({ error: 'id and text are required' }, { status: 400 });
    }

    // If vector not provided, compute it
    let { vector } = body;
    if (!vector) {
      vector = await embedText(`${title ?? ''}\n${text}`);
    }

    await storeNote({ id, title: title ?? '', type: type ?? '', text, vector });
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    console.error('[vector/store]', err);
    return NextResponse.json({ error: 'Failed to store vector' }, { status: 500 });
  }
}
