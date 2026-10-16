import { ScheduledTask, TaskPriority } from '@/types';
import { getDb } from '@/lib/db/client';

export interface ScheduleConflict {
  taskIdA: string;
  taskTitleA: string;
  taskIdB: string;
  taskTitleB: string;
  overlapMinutes: number;
}

export interface ScheduleAnalysis {
  overdueTasks: ScheduledTask[];
  conflicts: ScheduleConflict[];
  recommendedSchedule: Array<{
    taskId: string;
    title: string;
    proposedStart: string;
    proposedEnd: string;
  }>;
}

export class SchedulingWorker {
  private collectionName = 'scheduled_tasks';

  private async getCollection() {
    const db = await getDb();
    return db.collection(this.collectionName);
  }

  async createTask(params: {
    userId: string;
    title: string;
    description?: string;
    priority: TaskPriority;
    estimatedDuration: number;
    deadline?: string;
    scheduledStart?: string;
    dependencies?: string[];
  }): Promise<ScheduledTask> {
    const coll = await this.getCollection();
    const id = `sched_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    let scheduledEnd: string | undefined = undefined;
    if (params.scheduledStart) {
      const end = new Date(new Date(params.scheduledStart).getTime() + params.estimatedDuration * 60000);
      scheduledEnd = end.toISOString();
    }

    const task: ScheduledTask = {
      id,
      userId: params.userId,
      title: params.title,
      description: params.description,
      priority: params.priority,
      estimatedDuration: params.estimatedDuration,
      deadline: params.deadline,
      scheduledStart: params.scheduledStart,
      scheduledEnd,
      status: 'pending',
      dependencies: params.dependencies || [],
      createdAt: now,
      updatedAt: now,
    };

    await coll.insertOne(task);
    return task;
  }

  async listTasks(userId: string): Promise<ScheduledTask[]> {
    const coll = await this.getCollection();
    const tasks: ScheduledTask[] = await coll.find({ userId });
    const now = new Date();

    // Dynamically mark overdue tasks
    return tasks.map((t) => {
      if (t.status === 'pending' && t.deadline && new Date(t.deadline) < now) {
        return { ...t, status: 'overdue' as const };
      }
      return t;
    });
  }

  async updateTask(id: string, userId: string, patch: Partial<ScheduledTask>): Promise<ScheduledTask | null> {
    const coll = await this.getCollection();
    const update: any = { ...patch, updatedAt: new Date().toISOString() };

    if (patch.scheduledStart && patch.estimatedDuration) {
      update.scheduledEnd = new Date(new Date(patch.scheduledStart).getTime() + patch.estimatedDuration * 60000).toISOString();
    }

    await coll.updateOne({ id, userId }, { $set: update });
    return await coll.findOne({ id, userId });
  }

  async deleteTask(id: string, userId: string): Promise<boolean> {
    const coll = await this.getCollection();
    const res = await coll.deleteOne({ id, userId });
    return res.deletedCount > 0;
  }

  // Deterministic conflict detection
  detectConflicts(tasks: ScheduledTask[]): ScheduleConflict[] {
    const conflicts: ScheduleConflict[] = [];
    const scheduled = tasks.filter((t) => t.scheduledStart && t.scheduledEnd && t.status !== 'completed');

    for (let i = 0; i < scheduled.length; i++) {
      for (let j = i + 1; j < scheduled.length; j++) {
        const a = scheduled[i];
        const b = scheduled[j];

        const aStart = new Date(a.scheduledStart!).getTime();
        const aEnd = new Date(a.scheduledEnd!).getTime();
        const bStart = new Date(b.scheduledStart!).getTime();
        const bEnd = new Date(b.scheduledEnd!).getTime();

        const overlap = Math.min(aEnd, bEnd) - Math.max(aStart, bStart);
        if (overlap > 0) {
          conflicts.push({
            taskIdA: a.id,
            taskTitleA: a.title,
            taskIdB: b.id,
            taskTitleB: b.title,
            overlapMinutes: Math.round(overlap / 60000),
          });
        }
      }
    }
    return conflicts;
  }

  // Deterministic priority-aware scheduling calculation
  analyzeAndOptimizeSchedule(tasks: ScheduledTask[], workStartHour: number = 9): ScheduleAnalysis {
    const now = new Date();
    const overdueTasks = tasks.filter((t) => t.status === 'pending' && t.deadline && new Date(t.deadline) < now);
    const conflicts = this.detectConflicts(tasks);

    // Sort pending tasks by: Priority (urgent > high > medium > low), then nearest deadline
    const priorityWeight: Record<TaskPriority, number> = {
      urgent: 4,
      high: 3,
      medium: 2,
      low: 1,
    };

    const pending = tasks
      .filter((t) => t.status !== 'completed')
      .sort((a, b) => {
        const pDiff = priorityWeight[b.priority] - priorityWeight[a.priority];
        if (pDiff !== 0) return pDiff;
        if (a.deadline && b.deadline) return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        if (a.deadline) return -1;
        if (b.deadline) return 1;
        return 0;
      });

    // Schedule linearly during working hours starting tomorrow at 9:00 AM if overdue or conflict
    const cursor = new Date(now);
    cursor.setDate(cursor.getDate() + 1);
    cursor.setHours(workStartHour, 0, 0, 0);

    const recommendedSchedule = pending.map((task) => {
      const start = new Date(cursor);
      const end = new Date(start.getTime() + (task.estimatedDuration || 60) * 60000);

      // Advance cursor with 15-minute buffer
      cursor.setTime(end.getTime() + 15 * 60000);

      return {
        taskId: task.id,
        title: task.title,
        proposedStart: start.toISOString(),
        proposedEnd: end.toISOString(),
      };
    });

    return {
      overdueTasks,
      conflicts,
      recommendedSchedule,
    };
  }
}

export const schedulingWorker = new SchedulingWorker();
