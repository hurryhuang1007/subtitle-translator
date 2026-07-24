import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { TaskStatus } from '@prisma/client';

import { getSettings } from '@/server/config/settings';
import { prisma } from '@/server/db/client';
import { logger } from '@/server/logger/logger';
import {
  parseSubtitleFileContent,
  SubtitleParseError,
  type ParsedSubtitle,
} from '@/server/parser/parseSubtitle';
import { translateTexts } from '@/server/translator/googleTranslate';
import { resolveOutputPath } from '@/server/util/outputPath';

export async function parseTaskSource(filePath: string): Promise<ParsedSubtitle> {
  const content = await readFile(filePath, 'utf-8');
  return parseSubtitleFileContent(filePath, content);
}

async function updateProgress(taskId: string, progress: number) {
  await prisma.task.update({
    where: { id: taskId },
    data: { progress },
  });
}

export async function processTask(taskId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) {
    logger.warn(`任务不存在: ${taskId}`);
    return;
  }

  if (task.status !== TaskStatus.PENDING) {
    logger.info(`跳过非 PENDING 任务: ${task.filename} (${task.status})`);
    return;
  }

  const settings = await getSettings();
  const outputPath = resolveOutputPath(task.path, settings);

  await prisma.task.update({
    where: { id: taskId },
    data: {
      status: TaskStatus.RUNNING,
      startedAt: new Date(),
      finishedAt: null,
      progress: 5,
      error: null,
      language: settings.targetLanguage,
    },
  });

  try {
    const content = await readFile(task.path, 'utf-8');
    const parsed = parseSubtitleFileContent(task.path, content);
    await updateProgress(taskId, 20);
    logger.info(`解析完成: ${task.filename} cues=${parsed.cues.length}`);

    const sourceTexts = parsed.cues.map(cue => cue.text);
    const translatedTexts =
      sourceTexts.length === 0
        ? []
        : await translateTexts(sourceTexts, {
            to: settings.targetLanguage,
            from: settings.sourceLanguage,
            batchGapMs: settings.batchGapMs,
            forceBatch: settings.forceBatch,
            contextAware: settings.contextAwareTranslate,
            contextWindowSize: settings.contextWindowSize,
            onProgress: async (done, total) => {
              const ratio = total === 0 ? 1 : done / total;
              const progress = Math.min(90, Math.round(20 + ratio * 70));
              await updateProgress(taskId, progress);
            },
          });

    await updateProgress(taskId, 92);
    const output = parsed.rebuild(translatedTexts);
    await writeFile(outputPath, output, 'utf-8');

    await prisma.task.update({
      where: { id: taskId },
      data: {
        status: TaskStatus.SUCCESS,
        progress: 100,
        error: null,
        finishedAt: new Date(),
      },
    });

    logger.info(`翻译完成: ${task.filename} -> ${path.basename(outputPath)}`);
  } catch (error) {
    const message =
      error instanceof SubtitleParseError
        ? error.message
        : error instanceof Error
          ? error.message
          : String(error);

    logger.error(`任务失败: ${task.filename} - ${message}`);
    await prisma.task.update({
      where: { id: taskId },
      data: {
        status: TaskStatus.FAILED,
        progress: 100,
        error: message,
        finishedAt: new Date(),
      },
    });
  }
}
