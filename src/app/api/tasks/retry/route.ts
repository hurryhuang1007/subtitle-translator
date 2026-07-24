import { retryFailedTasks, retryTask } from '@/server/tasks/service';
import { apiFail, apiOk } from '@/server/util/apiResponse';

export async function POST(request: Request) {
  const body = (await request.json()) as { id?: string; allFailed?: boolean };

  if (body.allFailed) {
    const result = await retryFailedTasks();
    return apiOk(result);
  }

  if (!body.id) {
    return apiFail('Missing task id');
  }

  const task = await retryTask(body.id);
  return apiOk(task);
}
