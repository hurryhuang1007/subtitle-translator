import { TaskStatus } from '@prisma/client';

import { prisma } from '@/server/db/client';
import { getSettings } from '@/server/config/settings';
import { logger } from '@/server/logger/logger';
import { processTask } from '@/server/pipeline/processTask';
import { getMemoryQueue } from '@/server/queue/memoryQueue';
import { patchRuntimeStatus } from '@/server/status/runtimeStatus';
import { restartWatcher } from '@/server/watcher/watcher';

const globalForBootstrap = globalThis as unknown as {
  subtitleTranslatorBootstrapped?: boolean;
};

export async function bootstrapServer() {
  if (globalForBootstrap.subtitleTranslatorBootstrapped) {
    return;
  }

  await prisma.$connect();
  await logger.hydrateFromFile();

  const queue = getMemoryQueue();
  queue.setHandler(async taskId => {
    await processTask(taskId);
  });

  const settings = await getSettings();
  queue.setConcurrency(settings.queueConcurrency);

  const pendingTasks = await prisma.task.findMany({
    where: { status: TaskStatus.PENDING },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });
  queue.hydrate(pendingTasks.map(task => task.id));

  patchRuntimeStatus({
    watching: false,
    runningTasks: 0,
    waitingTasks: queue.size(),
  });

  if (settings.autoStart) {
    await restartWatcher();
  }

  globalForBootstrap.subtitleTranslatorBootstrapped = true;
  logger.info('服务已 bootstrap（翻译管线已接入）');
}
