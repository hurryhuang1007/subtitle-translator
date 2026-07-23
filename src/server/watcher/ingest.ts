import { access } from 'node:fs/promises';
import path from 'node:path';

import { TaskStatus } from '@prisma/client';

import { getSettings } from '@/server/config/settings';
import { prisma } from '@/server/db/client';
import { logger } from '@/server/logger/logger';
import { getMemoryQueue } from '@/server/queue/memoryQueue';
import { getFileFingerprint } from '@/server/util/fileHash';
import {
  isAlreadyTranslatedOutput,
  isSubtitleFile,
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

export async function ingestSubtitleFile(filePath: string) {
  const settings = await getSettings();
  const normalizedPath = path.resolve(filePath);
  const filename = path.basename(normalizedPath);

  if (!isSubtitleFile(normalizedPath)) {
    return;
  }

  if (isAlreadyTranslatedOutput(normalizedPath, settings)) {
    logger.info(`跳过已翻译输出文件: ${filename}`);
    return;
  }

  let fingerprint;
  try {
    fingerprint = await getFileFingerprint(normalizedPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`读取文件失败，跳过: ${normalizedPath} (${message})`);
    return;
  }

  const existingFingerprint = await prisma.fileFingerprint.findUnique({
    where: { path: normalizedPath },
  });

  // 内容未变化：静默跳过，避免 watcher 重启反复写入 SKIPPED
  if (
    existingFingerprint &&
    existingFingerprint.hash === fingerprint.hash &&
    existingFingerprint.mtimeMs === fingerprint.mtimeMs &&
    existingFingerprint.size === fingerprint.size
  ) {
    return;
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
    return;
  }

  const active = await prisma.task.findFirst({
    where: {
      path: normalizedPath,
      status: { in: [TaskStatus.PENDING, TaskStatus.RUNNING] },
    },
  });

  if (active) {
    logger.info(`已有进行中任务，跳过重复入队: ${filename}`);
    return;
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
}
