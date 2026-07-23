import translate from 'google-translate-api-x';

import { logger } from '@/server/logger/logger';

const MAX_CHARS_PER_BATCH = 4500;
const MAX_ITEMS_PER_BATCH = 40;
const DEFAULT_BATCH_GAP_MS = 400;

/** 单批次翻译最大重试次数（不含首次） */
const MAX_RETRIES = 5;
const RETRY_BASE_DELAY_MS = 1000;
const RETRY_MAX_DELAY_MS = 30_000;

export type TranslateTextsOptions = {
  to: string;
  batchGapMs?: number;
  onProgress?: (done: number, total: number) => void | Promise<void>;
};

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

function errorCode(error: unknown) {
  if (error && typeof error === 'object' && 'code' in error) {
    return String((error as { code?: unknown }).code ?? '');
  }
  return '';
}

function errorStatus(error: unknown) {
  if (!error || typeof error !== 'object') return null;
  const record = error as {
    status?: unknown;
    statusCode?: unknown;
    response?: { status?: unknown; statusCode?: unknown };
  };
  const candidates = [
    record.status,
    record.statusCode,
    record.response?.status,
    record.response?.statusCode,
  ];
  for (const value of candidates) {
    const num = Number(value);
    if (Number.isFinite(num) && num > 0) return num;
  }
  return null;
}

/** 限流 / 网络 / 网关类错误可重试；解析或参数类错误不重试 */
export function isRetryableTranslateError(error: unknown) {
  const status = errorStatus(error);
  if (
    status === 408 ||
    status === 425 ||
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504
  ) {
    return true;
  }

  const code = errorCode(error).toUpperCase();
  if (
    [
      'ECONNRESET',
      'ECONNREFUSED',
      'ECONNABORTED',
      'ETIMEDOUT',
      'ESOCKETTIMEDOUT',
      'ENOTFOUND',
      'EAI_AGAIN',
      'EPIPE',
      'UND_ERR_CONNECT_TIMEOUT',
      'UND_ERR_HEADERS_TIMEOUT',
      'UND_ERR_BODY_TIMEOUT',
      'UND_ERR_SOCKET',
      'ABORT_ERR',
    ].includes(code)
  ) {
    return true;
  }

  const message = errorMessage(error).toLowerCase();
  return (
    message.includes('too many requests') ||
    message.includes('rate limit') ||
    message.includes('ratelimit') ||
    message.includes('429') ||
    message.includes('econnreset') ||
    message.includes('etimedout') ||
    message.includes('network') ||
    message.includes('fetch failed') ||
    message.includes('socket') ||
    message.includes('temporarily unavailable') ||
    message.includes('service unavailable') ||
    message.includes('bad gateway') ||
    message.includes('gateway timeout')
  );
}

function retryDelayMs(attempt: number) {
  // attempt: 1..N → 指数退避 + 少量抖动
  const exp = Math.min(RETRY_MAX_DELAY_MS, RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
  const jitter = Math.floor(Math.random() * 250);
  return Math.min(RETRY_MAX_DELAY_MS, exp + jitter);
}

async function withTranslateRetry<T>(label: string, run: () => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
      const retryable = isRetryableTranslateError(error);
      if (!retryable || attempt >= MAX_RETRIES) {
        throw error;
      }

      const delay = retryDelayMs(attempt + 1);
      logger.warn(
        `${label} 失败，${delay}ms 后重试 (${attempt + 1}/${MAX_RETRIES}): ${errorMessage(error)}`
      );
      await sleep(delay);
    }
  }

  throw lastError;
}

function buildBatches(texts: string[]) {
  const batches: string[][] = [];
  let current: string[] = [];
  let currentChars = 0;

  for (const text of texts) {
    const size = text.length || 1;
    const exceedItems = current.length >= MAX_ITEMS_PER_BATCH;
    const exceedChars = current.length > 0 && currentChars + size > MAX_CHARS_PER_BATCH;

    if (exceedItems || exceedChars) {
      batches.push(current);
      current = [];
      currentChars = 0;
    }

    current.push(text);
    currentChars += size;
  }

  if (current.length > 0) {
    batches.push(current);
  }

  return batches;
}

async function translateBatch(texts: string[], to: string) {
  if (texts.length === 0) return [] as string[];

  // 空串直接保留，避免无意义请求
  const indexMap: number[] = [];
  const payload: string[] = [];
  texts.forEach((text, index) => {
    if (text.trim()) {
      indexMap.push(index);
      payload.push(text);
    }
  });

  const results = [...texts];
  if (payload.length === 0) {
    return results;
  }

  const response = await translate(payload, {
    to,
    forceBatch: true,
  } as Parameters<typeof translate>[1]);

  const list = Array.isArray(response) ? response : [response];
  list.forEach((item, i) => {
    const originalIndex = indexMap[i];
    if (originalIndex == null) return;
    results[originalIndex] = item.text;
  });

  return results;
}

export async function translateTexts(texts: string[], options: TranslateTextsOptions) {
  const { to, onProgress } = options;
  const batchGapMs =
    typeof options.batchGapMs === 'number' && Number.isFinite(options.batchGapMs)
      ? Math.max(0, Math.round(options.batchGapMs))
      : DEFAULT_BATCH_GAP_MS;

  if (texts.length === 0) {
    return [];
  }

  const batches = buildBatches(texts);
  const output: string[] = [];
  let done = 0;

  for (let i = 0; i < batches.length; i += 1) {
    const batch = batches[i] ?? [];
    try {
      const translated = await withTranslateRetry(`翻译批次 ${i + 1}/${batches.length}`, () =>
        translateBatch(batch, to)
      );
      output.push(...translated);
    } catch (error) {
      const message = errorMessage(error);
      logger.error(`翻译批次失败 (${i + 1}/${batches.length}): ${message}`);
      throw error;
    }

    done += batch.length;
    await onProgress?.(done, texts.length);

    if (i < batches.length - 1 && batchGapMs > 0) {
      await sleep(batchGapMs);
    }
  }

  return output;
}
