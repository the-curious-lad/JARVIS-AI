import { NextRequest, NextResponse } from 'next/server';
import { actionQueue } from '@/lib/queue/actionQueue';
import { copilotOrchestrator } from '@/lib/copilot/orchestrator';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId') || 'default_user';

  try {
    const tasks = await actionQueue.getAllTasks(userId);
    return NextResponse.json({ tasks });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, taskId, userId = 'default_user' } = body;

    if (!taskId || !action) {
      return NextResponse.json({ error: 'taskId and action are required' }, { status: 400 });
    }

    let updatedTask = null;

    if (action === 'approve') {
      updatedTask = await actionQueue.approveTask(taskId, userId);
      // Resume execution of the plan after approval
      if (updatedTask?.planId) {
        await copilotOrchestrator.executePlan(updatedTask.planId, userId);
      }
    } else if (action === 'retry') {
      updatedTask = await actionQueue.retryTask(taskId, userId);
      if (updatedTask?.planId) {
        await copilotOrchestrator.executePlan(updatedTask.planId, userId);
      }
    } else if (action === 'cancel') {
      updatedTask = await actionQueue.cancelTask(taskId, userId, body.reason);
    } else {
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    const allTasks = await actionQueue.getAllTasks(userId);
    return NextResponse.json({ task: updatedTask, tasks: allTasks });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
