import { NextResponse } from 'next/server';

import { bootstrapServer } from '@/server/bootstrap';
import { retryTask } from '@/server/tasks/service';

export async function POST(request: Request) {
  await bootstrapServer();

  const body = (await request.json()) as { id?: string };
  if (!body.id) {
    return NextResponse.json({ message: 'Missing task id' }, { status: 400 });
  }

  const task = await retryTask(body.id);
  return NextResponse.json(task);
}
