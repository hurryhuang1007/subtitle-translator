import { access } from 'node:fs/promises';
import path from 'node:path';

import { TaskStatus } from '@prisma/client';

import { getSettings } from '@/server/config/settings';
import { prisma } from '@/server/db/client';
import { logger } from '@/server/logger/logger';
import { getMemoryQueue } from '@/server/queue/memoryQueue';
import { getFileFingerprint, getFileStatFingerprint } from '@/server/util/fileHash';
import {
  isAlreadyTranslatedOutput,
  isSubtitleFile,
  matchesFilenamePattern,
  resolveOutputPath,
} from '@/server/util/outputPath';

async function fileExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function upsertFingerprint(
  filePath: string,
  fingerprint: { hash: string; mtimeMs: bigint; size: bigint }
) {
  await prisma.fileFingerprint.upsert({
    where: { path: filePath },
    create: {
      path: filePath,
      hash: fingerprint.hash,
      mtimeMs: fingerprint.mtimeMs,
      size: fingerprint.size,
    },
    update: {
      hash: fingerprint.hash,
      mtimeMs: fingerprint.mtimeMs,
      size: fingerprint.size,
    },
  });
}

export type IngestResult = 'enqueued' | 'skipped' | 'unchanged' | 'duplicate' | 'ignored';

export async function ingestSubtitleFile(filePath: string): Promise<IngestResult> {
  const settings = await getSettings();
  const normalizedPath = path.resolve(filePath);
  const filename = path.basename(normalizedPath);

  if (!isSubtitleFile(normalizedPath)) {
    return 'ignored';
  }

  if (!matchesFilenamePattern(normalizedPath, settings.filenamePattern)) {
    logger.info(`文件名不匹配规则，跳过: ${filename}`);
    return 'ignored';
  }

  if (isAlreadyTranslatedOutput(normalizedPath, settings)) {
    logger.info(`跳过已翻译输出文件: ${filename}`);
    return 'ignored';
  }

  let statFingerprint;
  try {
    statFingerprint = await getFileStatFingerprint(normalizedPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`读取文件失败，跳过: ${normalizedPath} (${message})`);
    return 'ignored';
  }

  const existingFingerprint = await prisma.fileFingerprint.findUnique({
    where: { path: normalizedPath },
  });

  // mtime + size 未变：跳过全量 hash，避免大批量扫描时卡住
  if (
    existingFingerprint &&
    existingFingerprint.mtimeMs === statFingerprint.mtimeMs &&
    existingFingerprint.size === statFingerprint.size
  ) {
    return 'unchanged';
  }

  let fingerprint;
  try {
    fingerprint = await getFileFingerprint(normalizedPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`读取文件失败，跳过: ${normalizedPath} (${message})`);
    return 'ignored';
  }

  const outputPath = resolveOutputPath(normalizedPath, settings);
  if (settings.skipIfExists && (await fileExists(outputPath))) {
    await prisma.task.create({
      data: {
        path: normalizedPath,
        filename,
        hash: fingerprint.hash,
        status: TaskStatus.SKIPPED,
        progress: 100,
        language: settings.targetLanguage,
        error: `目标文件已存在: ${path.basename(outputPath)}`,
        finishedAt: new Date(),
      },
    });
    await upsertFingerprint(normalizedPath, fingerprint);
    logger.info(`目标已存在，SKIPPED: ${filename} -> ${path.basename(outputPath)}`);
    return 'skipped';
  }

  const active = await prisma.task.findFirst({
    where: {
      path: normalizedPath,
      status: { in: [TaskStatus.PENDING, TaskStatus.RUNNING] },
    },
  });

  if (active) {
    logger.info(`已有进行中任务，跳过重复入队: ${filename}`);
    return 'duplicate';
  }

  const task = await prisma.task.create({
    data: {
      path: normalizedPath,
      filename,
      hash: fingerprint.hash,
      status: TaskStatus.PENDING,
      progress: 0,
      language: settings.targetLanguage,
    },
  });

  await upsertFingerprint(normalizedPath, fingerprint);
  getMemoryQueue().enqueue(task.id);
  logger.info(`已入队: ${filename} (${task.id})`);
  return 'enqueued';
}
