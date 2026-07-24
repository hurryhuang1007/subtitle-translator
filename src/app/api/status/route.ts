import { bootstrapServer } from '@/server/bootstrap';
import { getSettings } from '@/server/config/settings';
import { prisma } from '@/server/db/client';
import { getRuntimeStatus } from '@/server/status/runtimeStatus';
import { apiOk } from '@/server/util/apiResponse';
import { getScanProgress } from '@/server/watcher/scan';

function getTodayRange() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export async function GET() {
  await bootstrapServer();

  const runtime = getRuntimeStatus();
  const { start, end } = getTodayRange();

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
