import { access } from 'node:fs/promises';
import path from 'node:path';

import chokidar, { type FSWatcher } from 'chokidar';

import { getSettings } from '@/server/config/settings';
import { logger } from '@/server/logger/logger';
import { patchRuntimeStatus } from '@/server/status/runtimeStatus';
import { ingestSubtitleFile } from '@/server/watcher/ingest';
import { startScanWatchDirs } from '@/server/watcher/scan';

const IGNORED_EXTS = new Set([
  '.mkv',
  '.mp4',
  '.jpg',
  '.jpeg',
  '.png',
  '.tmp',
  '.part',
  '.download',
]);

type WatcherState = {
  watcher: FSWatcher | null;
  debounceTimers: Map<string, ReturnType<typeof setTimeout>>;
  debounceMs: number;
};

const globalForWatcher = globalThis as unknown as {
  subtitleWatcherState?: WatcherState;
};

function getState(): WatcherState {
  if (!globalForWatcher.subtitleWatcherState) {
    globalForWatcher.subtitleWatcherState = {
      watcher: null,
      debounceTimers: new Map(),
      debounceMs: 800,
    };
  }
  return globalForWatcher.subtitleWatcherState;
}

function shouldIgnore(filePath: string) {
  const base = path.basename(filePath);
  if (base.startsWith('.')) return true;

  const ext = path.extname(filePath).toLowerCase();
  if (IGNORED_EXTS.has(ext)) return true;

  return false;
}

function scheduleIngest(filePath: string) {
  const state = getState();
  const existing = state.debounceTimers.get(filePath);
  if (existing) {
    clearTimeout(existing);
  }

  const timer = setTimeout(() => {
    state.debounceTimers.delete(filePath);
    void ingestSubtitleFile(filePath);
  }, state.debounceMs);

  state.debounceTimers.set(filePath, timer);
}

async function ensureDirsExist(dirs: string[]) {
  const available: string[] = [];

  for (const dir of dirs) {
    try {
      await access(dir);
      available.push(dir);
    } catch {
      logger.warn(`监听目录不存在，已跳过: ${dir}`);
    }
  }

  return available;
}

export async function startWatcher() {
  const settings = await getSettings();
  const state = getState();
  state.debounceMs = settings.debounceMs;

  await stopWatcher();

  const watchDirs = await ensureDirsExist(settings.watchDirs);
  if (watchDirs.length === 0) {
    logger.warn('没有可监听的目录，watcher 未启动');
    patchRuntimeStatus({ watching: false });
    return;
  }

  // 初始全量入库不依赖 chokidar 的 add 风暴（上千文件并发 ingest 会漏）；
  // 改为 ready 后走顺序后台扫描；watcher 只负责后续增量变更。
  const watcher = chokidar.watch(watchDirs, {
    ignoreInitial: true,
    persistent: true,
    followSymlinks: true,
    awaitWriteFinish: {
      stabilityThreshold: Math.max(200, Math.floor(settings.debounceMs / 2)),
      pollInterval: 100,
    },
    ignored: (filePath: string) => shouldIgnore(filePath),
  });

  watcher
    .on('add', filePath => {
      scheduleIngest(filePath);
    })
    .on('change', filePath => {
      scheduleIngest(filePath);
    })
    .on('error', error => {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`watcher 错误: ${message}`);
    })
    .on('ready', () => {
      logger.info(`watcher 已启动: ${watchDirs.join(', ')}`);
      const progress = startScanWatchDirs();
      if (progress.status === 'running') {
        logger.info('已开始启动后全量扫描');
      }
    });

  state.watcher = watcher;
  patchRuntimeStatus({ watching: true });
}

export async function stopWatcher() {
  const state = getState();

  for (const timer of state.debounceTimers.values()) {
    clearTimeout(timer);
  }
  state.debounceTimers.clear();

  if (state.watcher) {
    await state.watcher.close();
    state.watcher = null;
    logger.info('watcher 已停止');
  }

  patchRuntimeStatus({ watching: false });
}

export function isWatcherRunning() {
  return Boolean(getState().watcher);
}

export async function restartWatcher() {
  const settings = await getSettings();
  if (!settings.autoStart) {
    await stopWatcher();
    return;
  }
  await startWatcher();
}
