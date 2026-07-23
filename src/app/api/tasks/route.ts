import { TaskStatus } from '@prisma/client';
import { NextResponse } from 'next/server';

import { bootstrapServer } from '@/server/bootstrap';
import { listTasks } from '@/server/tasks/service';

export async function GET(request: Request) {
  await bootstrapServer();

  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get('keyword')?.trim() || undefined;
  const statusParam = searchParams.get('status');
  const status =
    statusParam && Object.values(TaskStatus).includes(statusParam as TaskStatus)
      ? (statusParam as TaskStatus)
      : undefined;

  const tasks = await listTasks({ keyword, status });
  return NextResponse.json(tasks);
}
