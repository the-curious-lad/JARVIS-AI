import { NextRequest, NextResponse } from 'next/server';
import { documentWorker } from '@/lib/workers/documentWorker';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId') || 'default_user';
  const format = searchParams.get('format');
  const id = params.id;

  try {
    const doc = await documentWorker.getDocument(id, userId);
    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    if (format === 'docx') {
      const buffer = await documentWorker.generateDocxBuffer(doc);
      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(doc.title.replace(/[^a-zA-Z0-9_-]/g, '_'))}.docx"`,
        },
      });
    }

    if (format === 'markdown' || format === 'md') {
      return new NextResponse(doc.markdownContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(doc.title.replace(/[^a-zA-Z0-9_-]/g, '_'))}.md"`,
        },
      });
    }

    return NextResponse.json({ document: doc });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
