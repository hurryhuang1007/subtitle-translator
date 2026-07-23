import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

import { TaskStatus } from '@prisma/client';

import { prisma } from '../src/server/db/client';
import { processTask } from '../src/server/pipeline/processTask';

async function main() {
  const mediaDir = path.join(process.cwd(), 'media');
  await mkdir(mediaDir, { recursive: true });

  const inputPath = path.join(mediaDir, 'smoke-translate.srt');
  const outputPath = path.join(mediaDir, 'smoke-translate.zh.srt');

  await writeFile(
    inputPath,
    [
      '1',
      '00:00:01,000 --> 00:00:02,000',
      'Hello world',
      '',
      '2',
      '00:00:03,000 --> 00:00:04,000',
      'Good morning',
      '',
      '',
    ].join('\n'),
    'utf-8'
  );

  // 清理同路径旧任务，避免干扰
  await prisma.task.deleteMany({ where: { path: inputPath } });

  const task = await prisma.task.create({
    data: {
      path: inputPath,
      filename: path.basename(inputPath),
      status: TaskStatus.PENDING,
      progress: 0,
      language: 'zh-CN',
    },
  });

  console.log('created task', task.id);
  await processTask(task.id);

  const updated = await prisma.task.findUnique({ where: { id: task.id } });
  console.log('task status', updated?.status, updated?.error);

  const output = await readFile(outputPath, 'utf-8');
  console.log('--- output ---');
  console.log(output);

  if (updated?.status !== TaskStatus.SUCCESS) {
    process.exitCode = 1;
  }
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
