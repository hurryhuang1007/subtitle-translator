import { getSettings } from '@/server/config/settings';
import { prisma } from '@/server/db/client';
import { getRuntimeStatus } from '@/server/status/runtimeStatus';
import { apiOk } from '@/server/util/apiResponse';
import { getScanProgress } from '@/server/watcher/scan';

const MAX_DAY_RANGE_MS = 48 * 60 * 60 * 1000;

function getServerTodayRange() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

/** 优先用前端传来的本地日界；非法或缺失时回退服务端本地日 */
function resolveDayRange(request: Request) {
  const { searchParams } = new URL(request.url);
  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');

  if (fromParam && toParam) {
    const start = new Date(fromParam);
    const end = new Date(toParam);
    const startMs = start.getTime();
    const endMs = end.getTime();
    if (
      Number.isFinite(startMs) &&
      Number.isFinite(endMs) &&
      endMs > startMs &&
      endMs - startMs <= MAX_DAY_RANGE_MS
    ) {
      return { start, end };
    }
  }

  return getServerTodayRange();
}

export async function GET(request: Request) {
  const runtime = getRuntimeStatus();
  const { start, end } = resolveDayRange(request);

  const [settings, successToday, failedToday, recentTasks] = await Promise.all([
    getSettings(),
    prisma.task.count({
      where: {
        status: 'SUCCESS',
        updatedAt: { gte: start, lt: end },
      },
    }),
    prisma.task.count({
      where: {
        status: 'FAILED',
        updatedAt: { gte: start, lt: end },
      },
    }),
    prisma.task.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 8,
    }),
  ]);

  return apiOk({
    watching: runtime.watching,
    translationEnabled: settings.translationEnabled,
    running: runtime.runningTasks,
    waiting: runtime.waitingTasks,
    successToday,
    failedToday,
    memory: process.memoryUsage(),
    recentTasks,
    scan: getScanProgress(),
  });
}
