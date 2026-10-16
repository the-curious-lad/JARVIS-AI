import * as Sentry from '@sentry/nextjs';
import { getDb } from '@/lib/db/client';

export interface TraceRecord {
  id: string;
  traceId: string;
  planId?: string;
  taskId?: string;
  toolName?: string;
  spanName: string;
  startTime: number;
  endTime: number;
  durationMs: number;
  status: 'ok' | 'error';
  tags: Record<string, any>;
  errorMessage?: string;
  createdAt: string;
}

export class ObservabilityTracer {
  private collectionName = 'traces';

  private async getCollection() {
    const db = await getDb();
    return db.collection(this.collectionName);
  }

  private ensureSentryInit() {
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;
    if (dsn && !Sentry.getClient()) {
      try {
        Sentry.init({
          dsn,
          tracesSampleRate: 1.0,
          debug: false,
        });
      } catch (e) {
        console.warn('Sentry auto-init warning:', e);
      }
    }
  }

  async recordSpan(record: Omit<TraceRecord, 'id' | 'createdAt'>): Promise<TraceRecord> {
    const id = `span_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const span: TraceRecord = {
      ...record,
      id,
      createdAt: new Date().toISOString(),
    };

    try {
      const coll = await this.getCollection();
      await coll.insertOne(span);
    } catch (err) {
      console.warn('Failed to persist trace record:', err);
    }

    // Forward to Sentry if configured
    try {
      this.ensureSentryInit();
      const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;
      if (dsn) {
        Sentry.captureMessage(`[Span] ${record.spanName} (${record.durationMs}ms)`, {
          level: record.status === 'error' ? 'error' : 'info',
          tags: {
            traceId: record.traceId,
            planId: record.planId || '',
            taskId: record.taskId || '',
            toolName: record.toolName || '',
            ...record.tags,
          },
        });
      }
    } catch {
      // Sentry send error ignored
    }

    return span;
  }

  captureException(error: unknown, context?: Record<string, any>) {
    try {
      this.ensureSentryInit();
      const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;
      if (dsn) {
        return Sentry.captureException(error, { extra: context });
      }
    } catch {
      // Sentry send error ignored
    }
  }

  async sendTestEvent(): Promise<string | null> {
    try {
      this.ensureSentryInit();
      const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;
      if (!dsn) return null;
      const eventId = Sentry.captureMessage('JARVIS Sentry Healthcheck — All Systems Operational', {
        level: 'info',
        tags: {
          app: 'jarvis-ai',
          environment: process.env.NODE_ENV || 'development',
          source: 'healthcheck',
        },
      });
      await Sentry.flush(2000);
      return eventId;
    } catch (err) {
      console.warn('Failed to send test event to Sentry:', err);
      return null;
    }
  }

  async getTraces(limit = 50): Promise<TraceRecord[]> {
    const coll = await this.getCollection();
    const traces: TraceRecord[] = await coll.find({});
    return traces.sort((a, b) => b.startTime - a.startTime).slice(0, limit);
  }

  async getTracesByPlan(planId: string): Promise<TraceRecord[]> {
    const coll = await this.getCollection();
    const traces: TraceRecord[] = await coll.find({ planId });
    return traces.sort((a, b) => a.startTime - b.startTime);
  }
}

export const tracer = new ObservabilityTracer();
