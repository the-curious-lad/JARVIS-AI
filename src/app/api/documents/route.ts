import { NextRequest, NextResponse } from 'next/server';
import { documentWorker } from '@/lib/workers/documentWorker';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId') || 'default_user';

  try {
    const documents = await documentWorker.listDocuments(userId);
    return NextResponse.json({ documents });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
