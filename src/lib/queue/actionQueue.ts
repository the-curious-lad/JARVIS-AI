import { Task, TaskStatus } from '@/types';
import { getDb } from '@/lib/db/client';
import { globalToolRegistry } from '@/lib/tools/registry';

export class ActionQueue {
  private collectionName = 'tasks';

  private async getCollection() {
    const db = await getDb();
    return db.collection(this.collectionName);
  }

  async enqueueTask(taskData: Omit<Task, 'id' | 'status' | 'attemptCount' | 'createdAt'>): Promise<Task> {
    const coll = await this.getCollection();
    const id = `task_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const task: Task = {
      ...taskData,
      id,
      status: taskData.dependencies.length === 0 ? (taskData.requiresApproval ? 'waiting_approval' : 'ready') : 'ready',
      attemptCount: 0,
      createdAt: new Date().toISOString(),
    };

    await coll.insertOne(task);
    return task;
  }

  async getTask(id: string, userId: string): Promise<Task | null> {
    const coll = await this.getCollection();
    return await coll.findOne({ id, userId });
  }

  async getTasksByPlan(planId: string, userId: string): Promise<Task[]> {
    const coll = await this.getCollection();
    return await coll.find({ planId, userId });
  }

  async getAllTasks(userId: string): Promise<Task[]> {
    const coll = await this.getCollection();
    const tasks = await coll.find({ userId });
    return tasks.sort((a: Task, b: Task) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async updateTaskStatus(
    id: string,
    userId: string,
    status: TaskStatus,
    patch: Partial<Task> = {}
  ): Promise<Task | null> {
    const coll = await this.getCollection();
    const updateData: any = {
      status,
      ...patch,
    };

    if (status === 'running' && !patch.startedAt) {
      updateData.startedAt = new Date().toISOString();
    }
    if ((status === 'completed' || status === 'failed' || status === 'cancelled') && !patch.completedAt) {
      updateData.completedAt = new Date().toISOString();
    }

    await coll.updateOne({ id, userId }, { $set: updateData });
    return await coll.findOne({ id, userId });
  }

  async approveTask(id: string, userId: string): Promise<Task | null> {
    const task = await this.getTask(id, userId);
    if (!task) throw new Error('Task not found');
    if (task.status !== 'waiting_approval') {
      throw new Error(`Cannot approve task with status "${task.status}"`);
    }

    return await this.updateTaskStatus(id, userId, 'ready', {
      approvalStatus: 'approved',
    });
  }

  async cancelTask(id: string, userId: string, reason?: string): Promise<Task | null> {
    const task = await this.getTask(id, userId);
    if (!task) throw new Error('Task not found');

    return await this.updateTaskStatus(id, userId, 'cancelled', {
      error: reason || 'Cancelled by user',
    });
  }

  async retryTask(id: string, userId: string): Promise<Task | null> {
    const task = await this.getTask(id, userId);
    if (!task) throw new Error('Task not found');
    if (task.status !== 'failed') {
      throw new Error('Only failed tasks can be retried');
    }

    return await this.updateTaskStatus(id, userId, 'ready', {
      error: undefined,
    });
  }

  // Check if all prerequisites of a task are completed
  async areDependenciesSatisfied(task: Task, userId: string): Promise<boolean> {
    if (!task.dependencies || task.dependencies.length === 0) return true;

    const coll = await this.getCollection();
    const allPlanTasks: Task[] = await coll.find({ planId: task.planId, userId });

    for (const depStepId of task.dependencies) {
      const depTask = allPlanTasks.find((t) => t.stepId === depStepId);
      if (!depTask || depTask.status !== 'completed') {
        return false;
      }
    }
    return true;
  }

  // Execute a single ready task through the registered tool
  async processTask(id: string, userId: string): Promise<Task> {
    const task = await this.getTask(id, userId);
    if (!task) throw new Error(`Task ${id} not found`);

    if (task.status === 'completed') return task;

    if (task.status === 'waiting_approval') {
      return task;
    }

    // Verify dependencies
    const depsOk = await this.areDependenciesSatisfied(task, userId);
    if (!depsOk) {
      return task; // Not ready yet
    }

    // Check bounded retry limits
    if (task.attemptCount >= task.maxAttempts) {
      await this.updateTaskStatus(id, userId, 'failed', {
        error: `Exceeded maximum retry attempts (${task.maxAttempts})`,
      });
      return (await this.getTask(id, userId))!;
    }

    // Mark running
    await this.updateTaskStatus(id, userId, 'running', {
      attemptCount: task.attemptCount + 1,
    });

    try {
      // Find output from dependent tasks to pass as enriched context
      const coll = await this.getCollection();
      const allPlanTasks: Task[] = await coll.find({ planId: task.planId, userId });
      const dependencyResults: Record<string, any> = {};
      for (const depId of task.dependencies) {
        const dep = allPlanTasks.find((t) => t.stepId === depId);
        if (dep && dep.result) {
          dependencyResults[depId] = dep.result;
        }
      }

      // Execute via registered tool
      const toolContext = {
        userId,
        planId: task.planId,
        taskId: task.id,
      };

      const enrichedInput = {
        ...task.input,
        _dependencyResults: dependencyResults,
      };

      const result = await globalToolRegistry.execute(task.taskType, enrichedInput, toolContext);

      // Mark completed
      await this.updateTaskStatus(id, userId, 'completed', {
        result,
        error: undefined,
      });

      return (await this.getTask(id, userId))!;
    } catch (err: any) {
      const isRetryable = task.attemptCount + 1 < task.maxAttempts;
      const nextStatus: TaskStatus = isRetryable ? 'retry_pending' : 'failed';

      await this.updateTaskStatus(id, userId, nextStatus, {
        error: err.message || 'Execution error',
      });

      return (await this.getTask(id, userId))!;
    }
  }

  // Recover eligible work after restart
  async recoverOrphanedWork(userId: string): Promise<Task[]> {
    const coll = await this.getCollection();
    // Any task marked running when the server rebooted is recovered to ready/retry_pending
    const runningTasks: Task[] = await coll.find({ userId, status: 'running' });
    const recovered: Task[] = [];

    for (const t of runningTasks) {
      if (t.attemptCount < t.maxAttempts) {
        const updated = await this.updateTaskStatus(t.id, userId, 'ready', {
          error: 'Recovered after process restart',
        });
        if (updated) recovered.push(updated);
      } else {
        const updated = await this.updateTaskStatus(t.id, userId, 'failed', {
          error: 'Interrupted during process restart with no retries left',
        });
        if (updated) recovered.push(updated);
      }
    }
    return recovered;
  }
}

export const actionQueue = new ActionQueue();
