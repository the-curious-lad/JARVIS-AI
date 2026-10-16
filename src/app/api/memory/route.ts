import { NextRequest, NextResponse } from 'next/server';
import { contextEngine } from '@/lib/memory/contextEngine';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId') || 'default_user';

  try {
    const memories = await contextEngine.getAllMemories(userId);
    const { formattedSummary } = await contextEngine.getRelevantContext(userId);
    return NextResponse.json({ memories, formattedSummary });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId = 'default_user', content, category = 'preference', type = 'explicit', confidence = 1.0 } = body;

    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    const memory = await contextEngine.saveOrUpdateMemory({
      userId,
      content,
      category,
      type,
      confidence,
      sourceInteraction: 'Manual entry via Memory Settings',
    });

    const memories = await contextEngine.getAllMemories(userId);
    return NextResponse.json({ memory, memories });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, userId = 'default_user', content, category } = body;

    if (!id || !content) {
      return NextResponse.json({ error: 'id and content are required' }, { status: 400 });
    }

    const updated = await contextEngine.updateMemory(id, userId, content, category);
    const memories = await contextEngine.getAllMemories(userId);
    return NextResponse.json({ memory: updated, memories });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const wipeAll = searchParams.get('wipeAll') === 'true';
    const userId = searchParams.get('userId') || 'default_user';

    if (wipeAll) {
      const count = await contextEngine.wipeAllMemories(userId);
      return NextResponse.json({ success: true, wipedCount: count, memories: [] });
    }

    if (!id) {
      return NextResponse.json({ error: 'id is required when wipeAll is false' }, { status: 400 });
    }

    const success = await contextEngine.deleteMemory(id, userId);
    const memories = await contextEngine.getAllMemories(userId);
    return NextResponse.json({ success, memories });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
