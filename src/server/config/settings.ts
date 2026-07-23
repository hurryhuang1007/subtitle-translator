import path from 'node:path';

import { prisma } from '@/server/db/client';

export type AppSettings = {
  watchDirs: string[];
  /** 匹配字幕文件名的正则；空字符串表示匹配全部字幕扩展名 */
  filenamePattern: string;
  targetLanguage: string;
  outputSuffixTemplate: string;
  autoStart: boolean;
  skipIfExists: boolean;
  debounceMs: number;
  /** 任务队列并发数 */
  queueConcurrency: number;
  /** 翻译批次间隔（毫秒） */
  batchGapMs: number;
  googleApiKey: string;
};

function defaultWatchDir() {
  const fromEnv = process.env.WATCH_DIR?.trim();
  if (fromEnv) return fromEnv;
  if (process.env.DOCKER === 'true') return '/media';
  return path.join(process.cwd(), 'media');
}

const DEFAULT_SETTINGS: AppSettings = {
  watchDirs: [defaultWatchDir()],
  filenamePattern: String.raw`.*\.(srt|ass|ssa)$`,
  targetLanguage: 'zh-CN',
  outputSuffixTemplate: '.{lang}',
  autoStart: true,
  skipIfExists: true,
  debounceMs: 800,
  queueConcurrency: 1,
  batchGapMs: 400,
  googleApiKey: '',
};

const SETTINGS_KEY = 'appSettings';

export async function getSettings(): Promise<AppSettings> {
  const row = await prisma.setting.findUnique({
    where: { key: SETTINGS_KEY },
  });

  if (!row) {
    return DEFAULT_SETTINGS;
  }

  try {
    return {
      ...DEFAULT_SETTINGS,
      ...(JSON.parse(row.value) as Partial<AppSettings>),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function updateSettings(input: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getSettings();
  const merged = {
    ...current,
    ...input,
  };

  await prisma.setting.upsert({
    where: { key: SETTINGS_KEY },
    create: {
      key: SETTINGS_KEY,
      value: JSON.stringify(merged),
    },
    update: {
      value: JSON.stringify(merged),
    },
  });

  const shouldRestartWatcher =
    JSON.stringify(current.watchDirs) !== JSON.stringify(merged.watchDirs) ||
    current.debounceMs !== merged.debounceMs ||
    current.autoStart !== merged.autoStart;

  if (shouldRestartWatcher) {
    const { restartWatcher } = await import('@/server/watcher/watcher');
    await restartWatcher();
  }

  if (current.queueConcurrency !== merged.queueConcurrency) {
    const { getMemoryQueue } = await import('@/server/queue/memoryQueue');
    getMemoryQueue().setConcurrency(merged.queueConcurrency);
  }

  return merged;
}
