import { bootstrapServer } from '@/server/bootstrap';
import { apiOk } from '@/server/util/apiResponse';
import { getScanProgress, startScanWatchDirs } from '@/server/watcher/scan';

export async function GET() {
  await bootstrapServer();
  return apiOk(getScanProgress());
}

export async function POST() {
  await bootstrapServer();
  const progress = startScanWatchDirs();
  return apiOk(progress);
}
