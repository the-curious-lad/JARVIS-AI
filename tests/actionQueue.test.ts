import { describe, it, expect, beforeEach } from 'vitest';
import { actionQueue } from '@/lib/queue/actionQueue';
import '@/lib/tools/setup';

describe('Persistent Action Queue', () => {
  const testUserId = `test_user_${Date.now()}`;
  const testPlanId = `test_plan_${Date.now()}`;

  it('should enqueue a task with ready status when no dependencies exist', async () => {
    const task = await actionQueue.enqueueTask({
      userId: testUserId,
      planId: testPlanId,
      stepId: 'step_1',
      taskType: 'research_search',
      input: { query: 'Gemma 2 benchmark' },
      dependencies: [],
      maxAttempts: 2,
      requiresApproval: false,
    });

    expect(task.id).toBeDefined();
    expect(task.status).toBe('ready');
    expect(task.attemptCount).toBe(0);
  });

  it('should mark task waiting_approval if requiresApproval is true', async () => {
    const task = await actionQueue.enqueueTask({
      userId: testUserId,
      planId: testPlanId,
      stepId: 'step_sens',
      taskType: 'email_draft',
      input: { context: 'Test draft' },
      dependencies: [],
      maxAttempts: 2,
      requiresApproval: true,
    });

    expect(task.status).toBe('waiting_approval');

    // Approve task
    const approved = await actionQueue.approveTask(task.id, testUserId);
    expect(approved?.status).toBe('ready');
    expect(approved?.approvalStatus).toBe('approved');
  });

  it('should enforce task dependencies', async () => {
    const task1 = await actionQueue.enqueueTask({
      userId: testUserId,
      planId: testPlanId,
      stepId: 'dep_1',
      taskType: 'research_search',
      input: { query: 'Dependency check' },
      dependencies: [],
      maxAttempts: 2,
      requiresApproval: false,
    });

    const task2 = await actionQueue.enqueueTask({
      userId: testUserId,
      planId: testPlanId,
      stepId: 'dep_2',
      taskType: 'document_create',
      input: { title: 'Dependent doc', type: 'summary' },
      dependencies: ['dep_1'],
      maxAttempts: 2,
      requiresApproval: false,
    });

    // Check dependencies of task 2 before task 1 completes
    const canRunBefore = await actionQueue.areDependenciesSatisfied(task2, testUserId);
    expect(canRunBefore).toBe(false);

    // Complete task 1
    await actionQueue.processTask(task1.id, testUserId);

    // Check dependencies of task 2 after task 1 completes
    const canRunAfter = await actionQueue.areDependenciesSatisfied(task2, testUserId);
    expect(canRunAfter).toBe(true);
  });

  it('should handle bounded retries and mark failed after exceeding maxAttempts', async () => {
    const task = await actionQueue.enqueueTask({
      userId: testUserId,
      planId: testPlanId,
      stepId: 'fail_step',
      taskType: 'research_search',
      input: { query: '' }, // Invalid query to force failure
      dependencies: [],
      maxAttempts: 1,
      requiresApproval: false,
    });

    const result = await actionQueue.processTask(task.id, testUserId);
    expect(result.status).toBe('failed');
    expect(result.error).toBeDefined();
  });

  it('should recover interrupted running tasks during restart', async () => {
    const task = await actionQueue.enqueueTask({
      userId: testUserId,
      planId: testPlanId,
      stepId: 'crash_step',
      taskType: 'research_search',
      input: { query: 'Valid query' },
      dependencies: [],
      maxAttempts: 3,
      requiresApproval: false,
    });

    // Manually simulate crash while running
    await actionQueue.updateTaskStatus(task.id, testUserId, 'running', { attemptCount: 1 });

    const recovered = await actionQueue.recoverOrphanedWork(testUserId);
    const recoveredTask = recovered.find((t) => t.id === task.id);
    expect(recoveredTask).toBeDefined();
    expect(recoveredTask?.status).toBe('ready');
  });
});
