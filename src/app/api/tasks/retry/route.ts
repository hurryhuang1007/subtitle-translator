import { NextResponse } from 'next/server';

import { bootstrapServer } from '@/server/bootstrap';
import { retryFailedTasks, retryTask } from '@/server/tasks/service';

export async function POST(request: Request) {
  await bootstrapServer();

  const body = (await request.json()) as { id?: string; allFailed?: boolean };

  if (body.allFailed) {
    const result = await retryFailedTasks();
    return NextResponse.json(result);
  }

  if (!body.id) {
    return NextResponse.json({ message: 'Missing task id' }, { status: 400 });
  }

  const task = await retryTask(body.id);
  return NextResponse.json(task);
}
