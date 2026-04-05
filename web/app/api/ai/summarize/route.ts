// web/app/api/ai/summarize/route.ts
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const SYSTEM_PROMPT = `你是一个专业的知识管理助手。请用3句话简洁总结以下笔记的核心内容，保留关键术语和洞见。要求：每句不超过25字，用中文回答，提取1-2个核心关键词。`;

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });
    }

    const { noteId, title, content } = await req.json();

    if (!content || content.trim().length === 0) {
      return NextResponse.json({ error: 'Content is empty' }, { status: 400 });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `笔记标题：${title}\n笔记内容：\n${content.slice(0, 2000)}` },
      ],
      max_tokens: 300,
      temperature: 0.3,
    });

    const summary = completion.choices[0]?.message?.content?.trim() ?? '';
    return NextResponse.json({ summary, noteId });
  } catch (err) {
    console.error('AI summarize error:', err);
    return NextResponse.json({ error: 'AI summarization failed' }, { status: 500 });
  }
}
