import translate from 'google-translate-api-x';

import { logger } from '@/server/logger/logger';
import {
  CLOUD_MAX_CHARS_PER_BATCH,
  CLOUD_MAX_ITEMS_PER_BATCH,
  cloudTranslateTexts,
} from '@/server/translator/cloudTranslate';
import { formatMachineTranslateError, MachineTranslateError } from '@/server/util/taskError';

const FREE_MAX_CHARS_PER_BATCH = 4500;
const FREE_MAX_ITEMS_PER_BATCH = 40;
const DEFAULT_BATCH_GAP_MS = 400;
const DEFAULT_CONTEXT_WINDOW_SIZE = 500;
const DEFAULT_CONTEXT_PREVIOUS_SIZE = 100;

/** 单次翻译默认最大重试次数（不含首次） */
const DEFAULT_MAX_RETRIES = 5;
const RETRY_BASE_DELAY_MS = 1000;
const RETRY_MAX_DELAY_MS = 30_000;

export type TranslateTextsOptions = {
  to: string;
  /** auto / 空 = 自动检测 */
  from?: string;
  /** Cloud Translation API Key；空则走免费接口 */
  apiKey?: string;
  batchGapMs?: number;
  /** 可重试错误的最大重试次数（不含首次），默认 5 */
  translateMaxRetries?: number;
  /** 默认 false：免费接口走更准确的 single 端点；Cloud 下批量质量相同，仍可用于控制请求形态 */
  forceBatch?: boolean;
  /** 默认 true：相邻多句合并成段落再翻译 */
  contextAware?: boolean;
  /** 一次窗口焦点句数，默认 500 */
  contextWindowSize?: number;
  /** 每批最多携带上文句数，默认 100 */
  contextPreviousSize?: number;
  /** 限流/风控时是否缩窗重试，默认 true */
  shrinkWindowOnRateLimit?: boolean;
  /** 缩窗重试次数，默认 3 */
  shrinkWindowRetries?: number;
  /** 窗口大小下限，默认 100 */
  shrinkWindowMinSize?: number;
  /** 上文句数下限，默认 30 */
  shrinkPreviousMinSize?: number;
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
  if (isRateLimitOrRejectError(error)) {
    return true;
  }

  const status = errorStatus(error);
  if (
    status === 408 ||
    status === 425 ||
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

/** 适合通过缩小窗口规避的限流 / 风控类错误 */
export function isRateLimitOrRejectError(error: unknown) {
  const candidates: unknown[] = [error];
  if (error instanceof Error && 'cause' in error && (error as { cause?: unknown }).cause != null) {
    candidates.push((error as { cause?: unknown }).cause);
  }

  for (const candidate of candidates) {
    const status = errorStatus(candidate);
    if (status === 429 || status === 503) {
      return true;
    }

    const message = errorMessage(candidate).toLowerCase();
    if (
      message.includes('partial translation request fail') ||
      message.includes('rejected by the server') ||
      message.includes('too many requests') ||
      message.includes('rate limit') ||
      message.includes('ratelimit') ||
      message.includes('429') ||
      message.includes('quota exceeded') ||
      message.includes('user rate limit')
    ) {
      return true;
    }
  }

  return false;
}

function shrinkDimension(current: number, min: number) {
  const floored = Math.max(min, Math.floor(current / 2));
  if (floored >= current) return null;
  return floored;
}

function retryDelayMs(attempt: number) {
  const exp = Math.min(RETRY_MAX_DELAY_MS, RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
  const jitter = Math.floor(Math.random() * 250);
  return Math.min(RETRY_MAX_DELAY_MS, exp + jitter);
}

async function withTranslateRetry<T>(
  label: string,
  run: () => Promise<T>,
  maxRetries: number
): Promise<T> {
  let lastError: unknown;
  const retries = Math.max(0, Math.floor(maxRetries));

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
      const retryable = isRetryableTranslateError(error);
      if (!retryable || attempt >= retries) {
        throw error;
      }

      const delay = retryDelayMs(attempt + 1);
      logger.warn(
        `${label} 失败，${delay}ms 后重试 (${attempt + 1}/${retries}): ${errorMessage(error)}`
      );
      await sleep(delay);
    }
  }

  throw lastError;
}

function normalizeSourceLanguage(from?: string) {
  const value = from?.trim().toLowerCase();
  if (!value || value === 'auto') return undefined;
  return value;
}

function normalizeApiKey(apiKey?: string) {
  const value = apiKey?.trim();
  return value || undefined;
}

function buildBatches(texts: string[], maxItems: number, maxChars: number) {
  const batches: string[][] = [];
  let current: string[] = [];
  let currentChars = 0;

  for (const text of texts) {
    const size = text.length || 1;
    const exceedItems = current.length >= maxItems;
    const exceedChars = current.length > 0 && currentChars + size > maxChars;

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

/** 收集 index 之前最多 limit 条非空字幕，作为上文 */
export function collectPreviousContext(texts: string[], index: number, limit: number) {
  const context: string[] = [];
  for (let j = index - 1; j >= 0 && context.length < limit; j -= 1) {
    const text = texts[j] ?? '';
    if (!text.trim()) continue;
    context.unshift(text);
  }
  return context;
}

const LINE_MARK_RE = /⟦\s*(\d+)\s*⟧/g;

/** 用不易被吃掉的标记包住每一行，便于翻译后精确抽回焦点句 */
export function buildMarkedBlock(lines: string[]) {
  return lines.map((line, i) => `⟦${i + 1}⟧${line}`).join('\n');
}

export function extractMarkedLine(translated: string, index1based: number) {
  const normalized = translated.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const re = new RegExp(`⟦\\s*${index1based}\\s*⟧\\s*([\\s\\S]*?)(?=⟦\\s*\\d+\\s*⟧|$)`);
  const match = re.exec(normalized);
  if (!match) return null;
  return (match[1] ?? '').replace(LINE_MARK_RE, '').replace(/^\s+|\s+$/g, '');
}

type TranslateCallOptions = {
  to: string;
  from?: string;
  forceBatch: boolean;
  apiKey?: string;
};

async function translateOne(text: string, options: TranslateCallOptions) {
  if (!text.trim()) return text;

  if (options.apiKey) {
    const [translated] = await cloudTranslateTexts([text], {
      apiKey: options.apiKey,
      to: options.to,
      from: options.from,
    });
    return translated ?? text;
  }

  const response = await translate(text, {
    to: options.to,
    from: options.from,
    forceBatch: options.forceBatch,
    fallbackBatch: true,
  } as Parameters<typeof translate>[1]);

  const item = Array.isArray(response) ? response[0] : response;
  return item?.text ?? text;
}

async function translateArray(texts: string[], options: TranslateCallOptions) {
  if (texts.length === 0) return [] as string[];

  const indexMap: number[] = [];
  const payload: string[] = [];
  texts.forEach((text, index) => {
    if (text.trim()) {
      indexMap.push(index);
      payload.push(text);
    }
  });

  const results = [...texts];
  if (payload.length === 0) return results;

  if (options.apiKey) {
    // Cloud：未强制 batch 时仍可逐条，便于与免费路径行为一致；forceBatch 时整批提交
    if (!options.forceBatch) {
      for (let i = 0; i < payload.length; i += 1) {
        const originalIndex = indexMap[i];
        if (originalIndex == null) continue;
        results[originalIndex] = await translateOne(payload[i] ?? '', options);
      }
      return results;
    }

    const cloudBatches = buildBatches(
      payload,
      CLOUD_MAX_ITEMS_PER_BATCH,
      CLOUD_MAX_CHARS_PER_BATCH
    );
    let payloadCursor = 0;
    for (const batch of cloudBatches) {
      const translated = await cloudTranslateTexts(batch, {
        apiKey: options.apiKey,
        to: options.to,
        from: options.from,
      });
      translated.forEach((text, i) => {
        const originalIndex = indexMap[payloadCursor + i];
        if (originalIndex == null) return;
        results[originalIndex] = text;
      });
      payloadCursor += batch.length;
    }
    return results;
  }

  // 数组输入只会走 batch 端点；forceBatch=false 时改为逐条 single
  if (!options.forceBatch) {
    for (let i = 0; i < payload.length; i += 1) {
      const originalIndex = indexMap[i];
      if (originalIndex == null) continue;
      results[originalIndex] = await translateOne(payload[i] ?? '', options);
    }
    return results;
  }

  const response = await translate(payload, {
    to: options.to,
    from: options.from,
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

/**
 * 非重叠窗口 + 上文消歧：每批翻译 windowSize 句焦点，前面最多带 previousLimit 句上下文。
 * 只采用焦点句译文。
 */
async function translateWindowWithContext(
  texts: string[],
  start: number,
  windowSize: number,
  previousLimit: number,
  options: TranslateCallOptions
) {
  const end = Math.min(texts.length, start + Math.max(1, Math.floor(windowSize)));
  const focusTexts = texts.slice(start, end);
  const results = [...focusTexts];

  const nonemptyFocusIndexes: number[] = [];
  focusTexts.forEach((text, i) => {
    if (text.trim()) nonemptyFocusIndexes.push(i);
  });
  if (nonemptyFocusIndexes.length === 0) return results;

  const prevLimit = Math.max(0, Math.floor(previousLimit));
  const previous = collectPreviousContext(texts, start, prevLimit);

  if (previous.length === 0 && nonemptyFocusIndexes.length === 1) {
    const only = nonemptyFocusIndexes[0]!;
    results[only] = await translateOne(focusTexts[only] ?? '', options);
    return results;
  }

  const blockLines = [...previous, ...focusTexts];
  const marked = buildMarkedBlock(blockLines);
  const translated = await translateOne(marked, options);

  for (const i of nonemptyFocusIndexes) {
    const markIndex = previous.length + i + 1;
    const extracted = extractMarkedLine(translated, markIndex);
    if (extracted != null && extracted.length > 0) {
      results[i] = extracted;
      continue;
    }

    logger.warn(
      `焦点句标记抽取失败 (#${start + i + 1})，回退为单句翻译: ${translated.slice(0, 80)}`
    );
    results[i] = await translateOne(focusTexts[i] ?? '', options);
  }

  return results;
}

export async function translateTexts(texts: string[], options: TranslateTextsOptions) {
  const {
    to,
    onProgress,
    forceBatch = false,
    contextAware = true,
    contextWindowSize = DEFAULT_CONTEXT_WINDOW_SIZE,
    contextPreviousSize = DEFAULT_CONTEXT_PREVIOUS_SIZE,
    shrinkWindowOnRateLimit = true,
    shrinkWindowRetries = 3,
    shrinkWindowMinSize = 100,
    shrinkPreviousMinSize = 30,
    translateMaxRetries = DEFAULT_MAX_RETRIES,
  } = options;
  const from = normalizeSourceLanguage(options.from);
  const apiKey = normalizeApiKey(options.apiKey);
  const batchGapMs =
    typeof options.batchGapMs === 'number' && Number.isFinite(options.batchGapMs)
      ? Math.max(0, Math.round(options.batchGapMs))
      : DEFAULT_BATCH_GAP_MS;
  const maxRetries =
    typeof translateMaxRetries === 'number' && Number.isFinite(translateMaxRetries)
      ? Math.max(0, Math.round(translateMaxRetries))
      : DEFAULT_MAX_RETRIES;

  if (texts.length === 0) {
    return [];
  }

  logger.info(
    apiKey
      ? `翻译 Provider: Google Cloud Translation（已配置 API Key） cues=${texts.length}`
      : `翻译 Provider: 免费 Google Translate 接口 cues=${texts.length}`
  );

  const callOptions: TranslateCallOptions = {
    to,
    from,
    forceBatch,
    apiKey,
  };

  const output: string[] = new Array(texts.length);
  let done = 0;

  if (contextAware) {
    let windowSize = Math.max(1, Math.floor(contextWindowSize));
    let previousSize = Math.max(0, Math.floor(contextPreviousSize));
    const minWindow = Math.max(1, Math.floor(shrinkWindowMinSize));
    const minPrevious = Math.max(0, Math.floor(shrinkPreviousMinSize));
    const maxShrinkRetries = Math.max(0, Math.floor(shrinkWindowRetries));
    let shrinkAttemptsUsed = 0;

    let start = 0;
    while (start < texts.length) {
      const chunkSize = Math.min(windowSize, texts.length - start);
      try {
        const translated = await withTranslateRetry(
          `翻译窗口 ${start + 1}-${start + chunkSize}/${texts.length}`,
          () => translateWindowWithContext(texts, start, windowSize, previousSize, callOptions),
          maxRetries
        );
        translated.forEach((text, i) => {
          output[start + i] = text;
        });
      } catch (error) {
        const canShrink =
          shrinkWindowOnRateLimit &&
          shrinkAttemptsUsed < maxShrinkRetries &&
          isRateLimitOrRejectError(error);

        if (canShrink) {
          const nextWindow = shrinkDimension(windowSize, minWindow);
          const nextPrevious = shrinkDimension(previousSize, minPrevious);
          if (nextWindow != null || nextPrevious != null) {
            if (nextWindow != null) windowSize = nextWindow;
            if (nextPrevious != null) previousSize = nextPrevious;
            shrinkAttemptsUsed += 1;
            logger.warn(
              `检测到限流/风控，缩窗重试 ${shrinkAttemptsUsed}/${maxShrinkRetries}: window=${windowSize} previous=${previousSize}`
            );
            if (batchGapMs > 0) {
              await sleep(batchGapMs);
            }
            continue;
          }
        }

        const scope = `窗口 ${start + 1}-${start + chunkSize}/${texts.length}`;
        const message = formatMachineTranslateError({
          provider: apiKey ? 'cloud' : 'free',
          scope,
          error,
        });
        logger.error(message);
        throw new MachineTranslateError(message, { cause: error });
      }

      done += chunkSize;
      start += chunkSize;
      await onProgress?.(done, texts.length);

      if (start < texts.length && batchGapMs > 0) {
        await sleep(batchGapMs);
      }
    }
    return output;
  }

  if (!forceBatch) {
    for (let i = 0; i < texts.length; i += 1) {
      const text = texts[i] ?? '';
      try {
        output[i] = await withTranslateRetry(
          `翻译句子 ${i + 1}/${texts.length}`,
          () => translateOne(text, callOptions),
          maxRetries
        );
      } catch (error) {
        const scope = `句子 ${i + 1}/${texts.length}`;
        const message = formatMachineTranslateError({
          provider: apiKey ? 'cloud' : 'free',
          scope,
          error,
        });
        logger.error(message);
        throw new MachineTranslateError(message, { cause: error });
      }

      done += 1;
      await onProgress?.(done, texts.length);

      if (i < texts.length - 1 && batchGapMs > 0 && text.trim()) {
        await sleep(batchGapMs);
      }
    }
    return output;
  }

  const maxItems = apiKey ? CLOUD_MAX_ITEMS_PER_BATCH : FREE_MAX_ITEMS_PER_BATCH;
  const maxChars = apiKey ? CLOUD_MAX_CHARS_PER_BATCH : FREE_MAX_CHARS_PER_BATCH;
  const batches = buildBatches(texts, maxItems, maxChars);
  let cursor = 0;
  for (let i = 0; i < batches.length; i += 1) {
    const batch = batches[i] ?? [];
    try {
      const translated = await withTranslateRetry(
        `翻译批次 ${i + 1}/${batches.length}`,
        () => translateArray(batch, callOptions),
        maxRetries
      );
      translated.forEach(text => {
        output[cursor] = text;
        cursor += 1;
      });
    } catch (error) {
      const scope = `批次 ${i + 1}/${batches.length}`;
      const message = formatMachineTranslateError({
        provider: apiKey ? 'cloud' : 'free',
        scope,
        error,
      });
      logger.error(message);
      throw new MachineTranslateError(message, { cause: error });
    }

    done += batch.length;
    await onProgress?.(done, texts.length);

    if (i < batches.length - 1 && batchGapMs > 0) {
      await sleep(batchGapMs);
    }
  }

  return output;
}
