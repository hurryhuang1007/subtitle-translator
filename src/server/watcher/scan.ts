import { access, readdir } from 'node:fs/promises';
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

export type ScanResult = {
  dirs: number;
  files: number;
  enqueued: number;
  skipped: number;
};

function shouldIgnore(filePath: string) {
  const base = path.basename(filePath);
  if (base.startsWith('.')) return true;

  const ext = path.extname(filePath).toLowerCase();
  if (IGNORED_EXTS.has(ext)) return true;

  return false;
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

async function walkDir(dir: string, out: string[]) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`读取目录失败，已跳过: ${dir} (${message})`);
    return;
  }

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkDir(fullPath, out);
      continue;
    }

    if (!entry.isFile() || shouldIgnore(fullPath) || !isSubtitleFile(fullPath)) {
      continue;
    }

    out.push(fullPath);
  }
}

/** 一次性扫描监听目录，将新字幕文件入队（不启动持续监听） */
export async function scanWatchDirs(): Promise<ScanResult> {
  const settings = await getSettings();
  const watchDirs = await ensureDirsExist(settings.watchDirs);

  if (watchDirs.length === 0) {
    throw new Error('没有可扫描的目录，请先在 Settings 配置监听目录');
  }

  const files: string[] = [];
  for (const dir of watchDirs) {
    await walkDir(dir, files);
  }

  let enqueued = 0;
  let skipped = 0;

  for (const filePath of files) {
    const result = await ingestSubtitleFile(filePath);
    if (result === 'enqueued') enqueued += 1;
    if (result === 'skipped') skipped += 1;
  }

  logger.info(
    `手动扫描完成: dirs=${watchDirs.length} files=${files.length} enqueued=${enqueued} skipped=${skipped}`
  );

  return {
    dirs: watchDirs.length,
    files: files.length,
    enqueued,
    skipped,
  };
}
