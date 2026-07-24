import { apiOk } from '@/server/util/apiResponse';
import { getScanProgress, startScanWatchDirs } from '@/server/watcher/scan';

export async function GET() {
  return apiOk(getScanProgress());
}

export async function POST() {
  const progress = startScanWatchDirs();
  return apiOk(progress);
}
