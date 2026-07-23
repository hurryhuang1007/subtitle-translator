import { NextResponse } from 'next/server';

import { bootstrapServer } from '@/server/bootstrap';
import { deleteTask, getTaskById } from '@/server/tasks/service';

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, { params }: Params) {
  await bootstrapServer();
  const { id } = await params;
  const task = await getTaskById(id);

  if (!task) {
    return NextResponse.json({ message: 'Task not found' }, { status: 404 });
  }

  return NextResponse.json(task);
}

export async function DELETE(_: Request, { params }: Params) {
  await bootstrapServer();
  const { id } = await params;
  await deleteTask(id);
  return new NextResponse(null, { status: 204 });
}
