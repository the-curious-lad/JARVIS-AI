import { NextRequest, NextResponse } from 'next/server';
import { chatStore } from '@/lib/chat/chatStore';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId') || req.cookies.get('jarvis_user_id')?.value || 'default_user';

  try {
    const conversations = await chatStore.listConversations(userId);
    return NextResponse.json({ conversations });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userId = body.userId || req.cookies.get('jarvis_user_id')?.value || 'default_user';
    const title = body.title;

    const conversation = await chatStore.createConversation(userId, title);
    return NextResponse.json({ conversation });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
