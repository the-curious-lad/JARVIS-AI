import { NextRequest, NextResponse } from 'next/server';
import { synthesizeSpeech } from '@/lib/voice/elevenlabs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const res = await synthesizeSpeech(text);

    if (res.audioBuffer) {
      return new NextResponse(new Uint8Array(res.audioBuffer), {
        status: 200,
        headers: {
          'Content-Type': res.mimeType,
          'Content-Length': res.audioBuffer.length.toString(),
        },
      });
    }

    return NextResponse.json({
      isFallback: true,
      message: res.message,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
