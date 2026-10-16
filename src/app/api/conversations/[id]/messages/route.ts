import { NextRequest, NextResponse } from 'next/server';
import { chatStore } from '@/lib/chat/chatStore';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId') || req.cookies.get('jarvis_user_id')?.value || 'default_user';
  const conversationId = params.id;

  try {
    const messages = await chatStore.getMessages(conversationId, userId);
    return NextResponse.json({ messages });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const userId = body.userId || req.cookies.get('jarvis_user_id')?.value || 'default_user';
    const conversationId = params.id;
    const { role = 'user', content } = body;

    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    const message = await chatStore.addMessage({
      conversationId,
      userId,
      role,
      content,
    });

    return NextResponse.json({ message });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
