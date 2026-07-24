import { bootstrapServer } from '@/server/bootstrap';
import { apiFail, apiOk } from '@/server/util/apiResponse';
import { scanWatchDirs } from '@/server/watcher/scan';

export async function POST() {
  await bootstrapServer();

  try {
    const result = await scanWatchDirs();
    return apiOk(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return apiFail(message);
  }
}
