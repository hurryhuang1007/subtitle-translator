import { access, readdir, realpath, stat } from 'node:fs/promises';
import path from 'node:path';

import { getSettings } from '@/server/config/settings';
import { logger } from '@/server/logger/logger';
import { isSubtitleFile } from '@/server/util/outputPath';
import { ingestSubtitleFile } from '@/server/watcher/ingest';

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

export type ScanStatus = 'idle' | 'running' | 'done' | 'error';
export type ScanPhase = 'walking' | 'ingesting' | null;

export type ScanProgress = {
  status: ScanStatus;
  phase: ScanPhase;
  dirsVisited: number;
  filesFound: number;
  processed: number;
  enqueued: number;
  skipped: number;
  unchanged: number;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
};

type ScanState = {
  running: boolean;
  progress: ScanProgress;
};

const globalForScan = globalThis as unknown as {
  subtitleScanState?: ScanState;
};

function defaultProgress(): ScanProgress {
  return {
    status: 'idle',
    phase: null,
    dirsVisited: 0,
    filesFound: 0,
    processed: 0,
    enqueued: 0,
    skipped: 0,
    unchanged: 0,
    error: null,
    startedAt: null,
    finishedAt: null,
  };
}

function getScanState(): ScanState {
  if (!globalForScan.subtitleScanState) {
    globalForScan.subtitleScanState = {
      running: false,
      progress: defaultProgress(),
    };
  }
  return globalForScan.subtitleScanState;
}

function patchProgress(patch: Partial<ScanProgress>) {
  const state = getScanState();
  state.progress = {
    ...state.progress,
    ...patch,
  };
}

export function getScanProgress(): ScanProgress {
  return getScanState().progress;
}

function shouldIgnoreName(name: string) {
  return name.startsWith('.');
}

function shouldIgnoreFile(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  return IGNORED_EXTS.has(ext);
}

async function ensureDirsExist(dirs: string[]) {
  const available: string[] = [];

  for (const dir of dirs) {
    try {
      await access(dir);
      available.push(dir);
    } catch {
      logger.warn(`扫描目录不存在，已跳过: ${dir}`);
    }
  }

  return available;
}

async function walkDir(dir: string, out: string[], visited: Set<string>) {
  let realDir: string;
  try {
    realDir = await realpath(dir);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`读取目录失败，已跳过: ${dir} (${message})`);
    return;
  }

  if (visited.has(realDir)) {
    return;
  }
  visited.add(realDir);
  patchProgress({ dirsVisited: getScanProgress().dirsVisited + 1 });

  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`读取目录失败，已跳过: ${dir} (${message})`);
    return;
  }

  for (const entry of entries) {
    if (shouldIgnoreName(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);

    let entryStat;
    try {
      // 跟随符号链接，兼容 NAS / *arr 软链目录
      entryStat = await stat(fullPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(`无法访问，已跳过: ${fullPath} (${message})`);
      continue;
    }

    if (entryStat.isDirectory()) {
      await walkDir(fullPath, out, visited);
      continue;
    }

    if (!entryStat.isFile() || shouldIgnoreFile(fullPath) || !isSubtitleFile(fullPath)) {
      continue;
    }

    out.push(fullPath);
    if (out.length % 200 === 0) {
      patchProgress({ filesFound: out.length });
    }
  }
}

async function runScan() {
  const startedAt = new Date().toISOString();
  patchProgress({
    ...defaultProgress(),
    status: 'running',
    phase: 'walking',
    startedAt,
  });

  try {
    const settings = await getSettings();
    const watchDirs = await ensureDirsExist(settings.watchDirs);

    if (watchDirs.length === 0) {
      throw new Error('没有可扫描的目录，请先在 Settings 配置监听目录');
    }

    const files: string[] = [];
    const visited = new Set<string>();
    for (const dir of watchDirs) {
      await walkDir(dir, files, visited);
    }

    patchProgress({
      phase: 'ingesting',
      filesFound: files.length,
      processed: 0,
      enqueued: 0,
      skipped: 0,
      unchanged: 0,
    });

    let enqueued = 0;
    let skipped = 0;
    let unchanged = 0;

    for (let i = 0; i < files.length; i += 1) {
      const result = await ingestSubtitleFile(files[i]!);
      if (result === 'enqueued') enqueued += 1;
      if (result === 'skipped') skipped += 1;
      if (result === 'unchanged') unchanged += 1;

      if ((i + 1) % 25 === 0 || i + 1 === files.length) {
        patchProgress({
          processed: i + 1,
          enqueued,
          skipped,
          unchanged,
        });
      }
    }

    patchProgress({
      status: 'done',
      phase: null,
      filesFound: files.length,
      processed: files.length,
      enqueued,
      skipped,
      unchanged,
      finishedAt: new Date().toISOString(),
      error: null,
    });

    logger.info(
      `目录扫描完成: dirsVisited=${getScanProgress().dirsVisited} files=${files.length} enqueued=${enqueued} skipped=${skipped} unchanged=${unchanged}`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    patchProgress({
      status: 'error',
      phase: null,
      error: message,
      finishedAt: new Date().toISOString(),
    });
    logger.error(`目录扫描失败: ${message}`);
  } finally {
    getScanState().running = false;
  }
}

/** 启动后台扫描；若已在扫描中则返回当前进度 */
export function startScanWatchDirs(): ScanProgress {
  const state = getScanState();
  if (state.running) {
    return state.progress;
  }

  state.running = true;
  void runScan();
  return getScanProgress();
}
