import path from 'node:path';

import { prisma } from '@/server/db/client';

export type AppSettings = {
  watchDirs: string[];
  /** 匹配字幕文件名的正则；空字符串表示匹配全部字幕扩展名 */
  filenamePattern: string;
  /** 原语言；auto 表示自动检测 */
  sourceLanguage: string;
  targetLanguage: string;
  outputSuffixTemplate: string;
  autoStart: boolean;
  skipIfExists: boolean;
  debounceMs: number;
  /** 任务队列并发数 */
  queueConcurrency: number;
  /** 翻译批次间隔（毫秒） */
  batchGapMs: number;
  /**
   * 机器翻译：对白上下文合并。
   * 开启后会把相邻多句合并成一段再翻译，通常更通顺。
   */
  contextAwareTranslate: boolean;
  /** 机器翻译：一次窗口大小（每批焦点句数） */
  contextWindowSize: number;
  /** 机器翻译：每批最多携带的上文句数 */
  contextPreviousSize: number;
  /**
   * 是否强制使用 Google batch 端点。
   * false 时走更准确的 single 端点，但更容易限流。
   */
  forceBatch: boolean;
  /** Google Cloud Translation API Key；空则走免费接口 */
  googleApiKey: string;
  /** 是否启用 OpenAI 兼容 LLM 翻译（优先于机器翻译） */
  llmEnabled: boolean;
  /** OpenAI 兼容 API Base URL，例如 https://api.openai.com/v1 */
  llmBaseUrl: string;
  /** LLM API Key */
  llmApiKey: string;
  /** 模型名，例如 gpt-4o-mini */
  llmModel: string;
  /** LLM 采样温度 */
  llmTemperature: number;
  /** LLM：一次窗口大小（每批焦点句数） */
  llmContextWindowSize: number;
  /** LLM：每批最多携带的上文句数 */
  llmContextPreviousSize: number;
  /** LLM 不可用时是否回退到机器翻译 */
  llmFallbackToMachine: boolean;
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
  sourceLanguage: 'auto',
  targetLanguage: 'zh-CN',
  outputSuffixTemplate: '.{lang}',
  autoStart: true,
  skipIfExists: true,
  debounceMs: 800,
  queueConcurrency: 1,
  batchGapMs: 400,
  contextAwareTranslate: true,
  contextWindowSize: 500,
  contextPreviousSize: 100,
  forceBatch: false,
  googleApiKey: '',
  llmEnabled: false,
  llmBaseUrl: 'https://api.openai.com/v1',
  llmApiKey: '',
  llmModel: '',
  llmTemperature: 0.2,
  // 字幕单句通常很短；按常见 128k 上下文，约 800 焦点 + 300 上文仍有较大余量
  llmContextWindowSize: 800,
  llmContextPreviousSize: 300,
  llmFallbackToMachine: true,
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
