import { patchRuntimeStatus } from '@/server/status/runtimeStatus';
import { logger } from '@/server/logger/logger';

export type QueueJobHandler = (taskId: string) => Promise<void>;

class MemoryQueue {
  private pending: string[] = [];
  private active = 0;
  private readonly concurrency: number;
  private handler: QueueJobHandler | null = null;
  private draining = false;

  constructor(concurrency = 1) {
    this.concurrency = concurrency;
  }

  setHandler(handler: QueueJobHandler | null) {
    this.handler = handler;
    if (handler) {
      void this.drain();
    }
  }

  size() {
    return this.pending.length;
  }

  activeCount() {
    return this.active;
  }

  enqueue(taskId: string) {
    if (this.pending.includes(taskId)) {
      return;
    }
    this.pending.push(taskId);
    this.syncStatus();
    void this.drain();
  }

  /** 启动时把库里 PENDING 任务重新放回内存队列 */
  hydrate(taskIds: string[]) {
    for (const id of taskIds) {
      if (!this.pending.includes(id)) {
        this.pending.push(id);
      }
    }
    this.syncStatus();
    void this.drain();
  }

  private syncStatus() {
    patchRuntimeStatus({
      waitingTasks: this.pending.length,
      runningTasks: this.active,
    });
  }

  private async drain() {
    if (!this.handler || this.draining) {
      return;
    }
    this.draining = true;

    try {
      while (this.active < this.concurrency && this.pending.length > 0) {
        if (!this.handler) {
          break;
        }

        const taskId = this.pending.shift();
        if (!taskId) break;

        this.active += 1;
        this.syncStatus();
        void this.runJob(taskId);
      }
    } finally {
      this.draining = false;
    }
  }

  private async runJob(taskId: string) {
    const handler = this.handler;
    try {
      if (!handler) {
        this.pending.unshift(taskId);
        return;
      }
      await handler(taskId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`任务执行失败 ${taskId}: ${message}`);
    } finally {
      this.active = Math.max(0, this.active - 1);
      this.syncStatus();
      void this.drain();
    }
  }
}

const globalForQueue = globalThis as unknown as {
  memoryQueue?: MemoryQueue;
};

export function getMemoryQueue() {
  if (!globalForQueue.memoryQueue) {
    globalForQueue.memoryQueue = new MemoryQueue(1);
  }
  return globalForQueue.memoryQueue;
}
