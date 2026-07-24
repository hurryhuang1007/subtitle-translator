import { Prisma, TaskStatus } from '@prisma/client';

import { prisma } from '@/server/db/client';
import { getMemoryQueue } from '@/server/queue/memoryQueue';

export type TaskFilter = {
  status?: TaskStatus;
  keyword?: string;
  page?: number;
  pageSize?: number;
};

const DEFAULT_PAGE_SIZE = 100;

export async function listTasks(filter: TaskFilter = {}) {
  const page = Math.max(1, Math.floor(filter.page ?? 1));
  const pageSize = Math.max(1, Math.floor(filter.pageSize ?? DEFAULT_PAGE_SIZE));

  const where: Prisma.TaskWhereInput = {};

  if (filter.status) {
    where.status = filter.status;
  }

  if (filter.keyword) {
    where.OR = [{ filename: { contains: filter.keyword } }, { path: { contains: filter.keyword } }];
  }

  const [total, items] = await Promise.all([
    prisma.task.count({ where }),
    prisma.task.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
  };
}

export async function getTaskById(id: string) {
  return prisma.task.findUnique({
    where: { id },
  });
}

export async function retryTask(id: string) {
  const task = await prisma.task.update({
    where: { id },
    data: {
      status: TaskStatus.PENDING,
      progress: 0,
      error: null,
      startedAt: null,
      finishedAt: null,
    },
  });

  getMemoryQueue().enqueue(task.id);
  return task;
}

export async function retryFailedTasks() {
  const failed = await prisma.task.findMany({
    where: { status: TaskStatus.FAILED },
    select: { id: true, filename: true },
    orderBy: { updatedAt: 'asc' },
  });

  if (failed.length === 0) {
    return { count: 0 };
  }

  const ids = failed.map(task => task.id);

  await prisma.task.updateMany({
    where: {
      id: { in: ids },
      status: TaskStatus.FAILED,
    },
    data: {
      status: TaskStatus.PENDING,
      progress: 0,
      error: null,
      startedAt: null,
      finishedAt: null,
    },
  });

  const queue = getMemoryQueue();
  for (const id of ids) {
    queue.enqueue(id);
  }

  return { count: ids.length };
}

export async function deleteTask(id: string) {
  await prisma.task.delete({
    where: { id },
  });
}
