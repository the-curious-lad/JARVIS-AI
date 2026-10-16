import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/client';
import { getGemmaProvider } from '@/lib/ai/gemma';

export async function GET() {
  const db = await getDb();
  const gemma = getGemmaProvider();

  const status = {
    database: {
      type: db.isAtlas ? 'MongoDB Atlas (Live Cluster)' : 'Embedded Persistent Store (Development Fallback)',
      isAtlas: db.isAtlas,
      status: 'healthy',
    },
    ai: {
      provider: gemma.name,
      isMock: gemma.isMock,
      status: 'ready',
    },
    search: {
      provider: process.env.SERPAPI_API_KEY ? 'SerpApi (Live Google Search)' : 'Fixture Research Engine (Development Fallback)',
      hasApiKey: !!process.env.SERPAPI_API_KEY,
      status: 'ready',
    },
    voice: {
      provider: process.env.ELEVENLABS_API_KEY ? 'ElevenLabs (Turbo v2.5)' : 'Web Speech API (Browser Fallback)',
      hasApiKey: !!process.env.ELEVENLABS_API_KEY,
      status: 'ready',
    },
    observability: {
      sentryConfigured: !!(process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN),
      localTracerActive: true,
      status: 'monitoring',
    },
    app: {
      name: 'Jarvis AI',
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
    },
  };

  return NextResponse.json(status);
}
