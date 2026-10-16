import { NextRequest, NextResponse } from 'next/server';
import { tracer } from '@/lib/observability/sentry';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const planId = searchParams.get('planId');

  try {
    const traces = planId ? await tracer.getTracesByPlan(planId) : await tracer.getTraces(100);
    return NextResponse.json({ traces });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
