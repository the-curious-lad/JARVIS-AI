import { describe, it, expect } from 'vitest';
import { schedulingWorker } from '@/lib/workers/schedulingWorker';
import { ScheduledTask } from '@/types';

describe('Deterministic Scheduling Logic', () => {
  const userId = `sched_user_${Date.now()}`;

  it('should create tasks with computed scheduledEnd', async () => {
    const task = await schedulingWorker.createTask({
      userId,
      title: 'Review PRs',
      priority: 'high',
      estimatedDuration: 45,
      scheduledStart: '2026-10-15T10:00:00.000Z',
    });

    expect(task.id).toBeDefined();
    expect(task.scheduledEnd).toBe('2026-10-15T10:45:00.000Z');
  });

  it('should detect conflicting overlapping tasks', () => {
    const taskA: ScheduledTask = {
      id: 'a',
      userId,
      title: 'Sprint Planning',
      priority: 'urgent',
      estimatedDuration: 60,
      scheduledStart: '2026-10-15T14:00:00.000Z',
      scheduledEnd: '2026-10-15T15:00:00.000Z',
      status: 'pending',
      dependencies: [],
      createdAt: '',
      updatedAt: '',
    };

    const taskB: ScheduledTask = {
      id: 'b',
      userId,
      title: 'Client Demo',
      priority: 'urgent',
      estimatedDuration: 30,
      scheduledStart: '2026-10-15T14:30:00.000Z',
      scheduledEnd: '2026-10-15T15:00:00.000Z',
      status: 'pending',
      dependencies: [],
      createdAt: '',
      updatedAt: '',
    };

    const conflicts = schedulingWorker.detectConflicts([taskA, taskB]);
    expect(conflicts.length).toBe(1);
    expect(conflicts[0].overlapMinutes).toBe(30);
  });

  it('should identify overdue tasks', async () => {
    // Deadline in the past
    await schedulingWorker.createTask({
      userId,
      title: 'Overdue assignment',
      priority: 'high',
      estimatedDuration: 30,
      deadline: '2026-01-01T00:00:00.000Z',
    });

    const tasks = await schedulingWorker.listTasks(userId);
    const overdue = tasks.find((t) => t.title === 'Overdue assignment');
    expect(overdue?.status).toBe('overdue');
  });

  it('should optimize and propose rescheduled timeline without overlaps', () => {
    const tasks: ScheduledTask[] = [
      {
        id: 'low_task',
        userId,
        title: 'Check analytics',
        priority: 'low',
        estimatedDuration: 30,
        status: 'pending',
        dependencies: [],
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'urgent_task',
        userId,
        title: 'Fix critical production CVE',
        priority: 'urgent',
        estimatedDuration: 60,
        status: 'pending',
        dependencies: [],
        createdAt: '',
        updatedAt: '',
      },
    ];

    const analysis = schedulingWorker.analyzeAndOptimizeSchedule(tasks);
    expect(analysis.recommendedSchedule.length).toBe(2);
    // Urgent task must be scheduled first
    expect(analysis.recommendedSchedule[0].taskId).toBe('urgent_task');
    expect(analysis.recommendedSchedule[1].taskId).toBe('low_task');
  });
});
