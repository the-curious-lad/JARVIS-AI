import { NextRequest, NextResponse } from 'next/server';
import { chatStore } from '@/lib/chat/chatStore';

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId') || req.cookies.get('jarvis_user_id')?.value || 'default_user';
  const id = params.id;

  try {
    await chatStore.deleteConversation(id, userId);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
