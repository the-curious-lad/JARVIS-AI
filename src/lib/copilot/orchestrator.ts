import { Plan, PlanStep, PlanStatus, Task } from '@/types';
import { getDb } from '@/lib/db/client';
import { getGemmaProvider } from '@/lib/ai/gemma';
import { contextEngine } from '@/lib/memory/contextEngine';
import { actionQueue } from '@/lib/queue/actionQueue';
import { globalToolRegistry } from '@/lib/tools/registry';
import '@/lib/tools/setup'; // Ensure tools are loaded

export class CopilotOrchestrator {
  private collectionName = 'plans';

  private async getCollection() {
    const db = await getDb();
    return db.collection(this.collectionName);
  }

  // 1. Planning: Interpret request, augment with personal context, generate structured plan
  async createPlan(userId: string, request: string): Promise<Plan> {
    const coll = await this.getCollection();
    const planId = `plan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Retrieve personal preferences and memory
    const { formattedSummary, memories } = await contextEngine.getRelevantContext(userId, request);

    // List available registered tools
    const availableTools = globalToolRegistry.getDescriptions();

    const model = getGemmaProvider();
    const prompt = `You are Jarvis Copilot, an autonomous AI coordinator.
Create a structured execution plan to achieve the user's objective.

User Request: "${request}"
User Context & Preferences:
${formattedSummary}

Available Registered Tools:
${JSON.stringify(availableTools, null, 2)}

Produce a valid JSON object matching this schema:
{
  "intendedOutcome": string,
  "verificationCriteria": string,
  "steps": [
    {
      "id": "step_1",
      "title": string,
      "worker": "research" | "document" | "email" | "scheduling",
      "tool": "research_search" | "document_create" | "email_draft" | "schedule_manage",
      "dependencies": string[],
      "input": object,
      "expectedOutput": string,
      "requiresApproval": boolean,
      "retryPolicy": { "maxRetries": number, "retryCount": 0 }
    }
  ]
}

Ensure step dependencies form a valid DAG. Steps must use only the available registered tools.`;

    let generatedPlanData: any;
    try {
      generatedPlanData = await model.generateStructured<any>(prompt, 'Structured Plan JSON');
    } catch {
      // Deterministic fallback plan if model parsing fails
      generatedPlanData = {
        intendedOutcome: 'Process request through registered tools',
        verificationCriteria: 'Deliverable produced',
        steps: [
          {
            id: 'step_1',
            title: 'Analyze and execute request',
            worker: 'research',
            tool: 'research_search',
            dependencies: [],
            input: { query: request },
            expectedOutput: 'Research findings',
            requiresApproval: false,
            retryPolicy: { maxRetries: 2, retryCount: 0 },
          },
        ],
      };
    }

    const steps: PlanStep[] = (generatedPlanData.steps || []).map((s: any, idx: number) => ({
      id: s.id || `step_${idx + 1}`,
      title: s.title || `Step ${idx + 1}`,
      worker: s.worker || 'research',
      tool: s.tool || 'research_search',
      dependencies: s.dependencies || [],
      input: s.input || {},
      expectedOutput: s.expectedOutput || 'Output',
      requiresApproval: !!s.requiresApproval,
      status: 'pending',
      retryPolicy: s.retryPolicy || { maxRetries: 2, retryCount: 0 },
    }));

    const now = new Date().toISOString();
    const plan: Plan = {
      id: planId,
      userId,
      request,
      intendedOutcome: generatedPlanData.intendedOutcome || request,
      steps,
      status: 'ready',
      verificationCriteria: generatedPlanData.verificationCriteria || 'Output meets specifications',
      createdAt: now,
      updatedAt: now,
    };

    await coll.insertOne(plan);

    // Enqueue all initial steps into the persistent Action Queue
    for (const step of steps) {
      await actionQueue.enqueueTask({
        userId,
        planId,
        stepId: step.id,
        taskType: step.tool,
        input: step.input,
        dependencies: step.dependencies,
        maxAttempts: step.retryPolicy.maxRetries || 2,
        requiresApproval: step.requiresApproval,
      });
    }

    return plan;
  }

  async getPlan(id: string, userId: string): Promise<Plan | null> {
    const coll = await this.getCollection();
    return await coll.findOne({ id, userId });
  }

  async listPlans(userId: string): Promise<Plan[]> {
    const coll = await this.getCollection();
    const plans: Plan[] = await coll.find({ userId });
    return plans.sort((a: Plan, b: Plan) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // 2. Execution: Run eligible tasks through Action Queue until completion or waiting approval
  async executePlan(planId: string, userId: string): Promise<{
    plan: Plan;
    tasks: Task[];
    hasPendingApproval: boolean;
    isCompleted: boolean;
  }> {
    const coll = await this.getCollection();
    const plan = await this.getPlan(planId, userId);
    if (!plan) throw new Error('Plan not found');

    await coll.updateOne({ id: planId, userId }, { $set: { status: 'running' as PlanStatus, updatedAt: new Date().toISOString() } });

    const tasks = await actionQueue.getTasksByPlan(planId, userId);
    let hasPendingApproval = false;
    let anyFailure = false;

    // Process tasks in dependency order
    for (const task of tasks) {
      if (task.status === 'completed') continue;

      if (task.status === 'waiting_approval') {
        hasPendingApproval = true;
        continue;
      }

      const depsReady = await actionQueue.areDependenciesSatisfied(task, userId);
      if (depsReady && (task.status === 'ready' || task.status === 'retry_pending')) {
        const processed = await actionQueue.processTask(task.id, userId);
        if (processed.status === 'waiting_approval') {
          hasPendingApproval = true;
        } else if (processed.status === 'failed') {
          anyFailure = true;
        }
      }
    }

    // Refresh tasks
    const updatedTasks = await actionQueue.getTasksByPlan(planId, userId);
    const allCompleted = updatedTasks.every((t) => t.status === 'completed');

    let planStatus: PlanStatus = 'running';
    if (allCompleted) {
      planStatus = 'completed';
    } else if (hasPendingApproval) {
      planStatus = 'waiting_approval';
    } else if (anyFailure) {
      planStatus = 'failed';
    }

    // Collect deliverable results
    const finalResults = updatedTasks
      .filter((t) => t.result)
      .map((t) => ({ stepId: t.stepId, result: t.result }));

    await coll.updateOne(
      { id: planId, userId },
      {
        $set: {
          status: planStatus,
          finalResult: finalResults,
          updatedAt: new Date().toISOString(),
        },
      }
    );

    const refreshedPlan = (await this.getPlan(planId, userId))!;

    // If completed, trigger memory extraction evaluation
    if (allCompleted) {
      try {
        const summary = finalResults.map((r) => JSON.stringify(r.result)).join(' ').substring(0, 500);
        await contextEngine.evaluateInteraction({
          userId,
          userRequest: plan.request,
          taskResultSummary: summary,
          sourceTaskId: updatedTasks[0]?.id,
        });
      } catch (err) {
        console.warn('Memory evaluation after plan completion warning:', err);
      }
    }

    return {
      plan: refreshedPlan,
      tasks: updatedTasks,
      hasPendingApproval,
      isCompleted: allCompleted,
    };
  }
}

export const copilotOrchestrator = new CopilotOrchestrator();
