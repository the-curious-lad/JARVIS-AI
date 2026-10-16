import { NextRequest, NextResponse } from 'next/server';
import { schedulingWorker } from '@/lib/workers/schedulingWorker';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId') || 'default_user';

  try {
    const tasks = await schedulingWorker.listTasks(userId);
    const analysis = schedulingWorker.analyzeAndOptimizeSchedule(tasks);

    return NextResponse.json({
      tasks,
      overdueTasks: analysis.overdueTasks,
      conflicts: analysis.conflicts,
      recommendedSchedule: analysis.recommendedSchedule,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      userId = 'default_user',
      title,
      description,
      priority = 'medium',
      estimatedDuration = 60,
      deadline,
      scheduledStart,
      dependencies = [],
    } = body;

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const task = await schedulingWorker.createTask({
      userId,
      title,
      description,
      priority,
      estimatedDuration: Number(estimatedDuration),
      deadline,
      scheduledStart,
      dependencies,
    });

    const tasks = await schedulingWorker.listTasks(userId);
    return NextResponse.json({ task, tasks });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, userId = 'default_user', ...patch } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const updated = await schedulingWorker.updateTask(id, userId, patch);
    const tasks = await schedulingWorker.listTasks(userId);
    return NextResponse.json({ task: updated, tasks });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const userId = searchParams.get('userId') || 'default_user';

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const success = await schedulingWorker.deleteTask(id, userId);
    const tasks = await schedulingWorker.listTasks(userId);
    return NextResponse.json({ success, tasks });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
