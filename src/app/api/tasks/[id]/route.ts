import { deleteTask, getTaskById } from '@/server/tasks/service';
import { apiFail, apiOk } from '@/server/util/apiResponse';

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, { params }: Params) {
  const { id } = await params;
  const task = await getTaskById(id);

  if (!task) {
    return apiFail('Task not found', { status: 404 });
  }

  return apiOk(task);
}

export async function DELETE(_: Request, { params }: Params) {
  const { id } = await params;
  await deleteTask(id);
  return apiOk(null);
}
