export type PlanStatus =
  | 'draft'
  | 'ready'
  | 'running'
  | 'waiting_approval'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type TaskStatus =
  | 'ready'
  | 'running'
  | 'completed'
  | 'failed'
  | 'waiting_approval'
  | 'cancelled'
  | 'retry_pending';

export type WorkerType =
  | 'research'
  | 'document'
  | 'email'
  | 'scheduling';

export interface PlanStep {
  id: string;
  title: string;
  worker: WorkerType;
  tool: string;
  dependencies: string[];
  input: Record<string, any>;
  expectedOutput: string;
  requiresApproval: boolean;
  status: 'pending' | 'ready' | 'running' | 'waiting_approval' | 'completed' | 'failed' | 'cancelled';
  retryPolicy: {
    maxRetries: number;
    retryCount: number;
  };
  result?: any;
  error?: string;
}

export interface Plan {
  id: string;
  userId: string;
  request: string;
  intendedOutcome: string;
  steps: PlanStep[];
  status: PlanStatus;
  verificationCriteria: string;
  finalResult?: any;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  userId: string;
  planId: string;
  stepId: string;
  taskType: string;
  input: Record<string, any>;
  dependencies: string[];
  status: TaskStatus;
  attemptCount: number;
  maxAttempts: number;
  idempotencyKey?: string;
  requiresApproval: boolean;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  result?: any;
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export type MemoryCategory =
  | 'preference'
  | 'profile'
  | 'project'
  | 'goal'
  | 'scheduling'
  | 'pattern';

export interface Memory {
  id: string;
  userId: string;
  category: MemoryCategory;
  content: string;
  type: 'explicit' | 'inferred';
  confidence: number; // 0.0 to 1.0
  embedding?: number[]; // Vector embedding for MongoDB Atlas Vector Search
  sourceTaskId?: string;
  sourceInteraction?: string;
  createdAt: string;
  updatedAt: string;
  expirationTime?: string;
  isDeleted: boolean;
}

export interface MemoryObservation {
  id: string;
  userId: string;
  sourceInteraction: string;
  candidateContent: string;
  category: MemoryCategory;
  suggestedType: 'explicit' | 'inferred';
  confidence: number;
  rationale: string;
  validated: boolean;
  createdAt: string;
}

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface ScheduledTask {
  id: string;
  userId: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  estimatedDuration: number; // in minutes
  deadline?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
  dependencies: string[];
  createdAt: string;
  updatedAt: string;
}

export interface DocumentSource {
  title: string;
  url: string;
  snippet?: string;
}

export interface GeneratedDocument {
  id: string;
  userId: string;
  planId?: string;
  title: string;
  type: 'research_report' | 'comparison' | 'summary' | 'email_draft' | 'project_plan';
  markdownContent: string;
  sources: DocumentSource[];
  createdAt: string;
}

export interface TraceSpan {
  id: string;
  traceId: string;
  name: string;
  startTime: number;
  endTime?: number;
  durationMs?: number;
  status: 'ok' | 'error';
  tags: Record<string, string | number | boolean>;
  error?: string;
}
