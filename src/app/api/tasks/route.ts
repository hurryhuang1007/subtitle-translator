import { TaskStatus } from '@prisma/client';

import { listTasks } from '@/server/tasks/service';
import { apiOk } from '@/server/util/apiResponse';

function parsePositiveInt(value: string | null, fallback: number) {
  if (value == null || value.trim() === '') return fallback;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 1) return fallback;
  return Math.floor(num);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get('keyword')?.trim() || undefined;
  const statusParam = searchParams.get('status');
  const status =
    statusParam && Object.values(TaskStatus).includes(statusParam as TaskStatus)
      ? (statusParam as TaskStatus)
      : undefined;
  const page = parsePositiveInt(searchParams.get('page'), 1);
  const pageSize = parsePositiveInt(searchParams.get('pageSize'), 100);

  const result = await listTasks({ keyword, status, page, pageSize });
  return apiOk(result);
}
