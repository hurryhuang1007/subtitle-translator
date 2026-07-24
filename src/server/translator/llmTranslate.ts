import { logger } from '@/server/logger/logger';

const DEFAULT_WINDOW_SIZE = 800;
const DEFAULT_PREVIOUS_SIZE = 300;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;
const RETRY_MAX_DELAY_MS = 20_000;

export type LlmTranslateOptions = {
  to: string;
  from?: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature?: number;
  batchGapMs?: number;
  contextWindowSize?: number;
  contextPreviousSize?: number;
  onProgress?: (done: number, total: number) => void | Promise<void>;
};

export class LlmTranslateError extends Error {
  status?: number;
  retryable: boolean;

  constructor(message: string, options?: { status?: number; retryable?: boolean }) {
    super(message);
    this.name = 'LlmTranslateError';
    this.status = options?.status;
    this.retryable = options?.retryable ?? false;
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

function collectPreviousContext(texts: string[], index: number, limit: number) {
  const context: string[] = [];
  for (let j = index - 1; j >= 0 && context.length < limit; j -= 1) {
    const text = texts[j] ?? '';
    if (!text.trim()) continue;
    context.unshift(text);
  }
  return context;
}

function retryDelayMs(attempt: number) {
  const exp = Math.min(RETRY_MAX_DELAY_MS, RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
  const jitter = Math.floor(Math.random() * 250);
  return Math.min(RETRY_MAX_DELAY_MS, exp + jitter);
}

function isRetryableStatus(status?: number) {
  return (
    status === 408 ||
    status === 425 ||
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504
  );
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.trim().replace(/\/+$/, '');
}

function languageLabel(code?: string) {
  const value = code?.trim();
  if (!value || value.toLowerCase() === 'auto') return 'auto-detect';
  const map: Record<string, string> = {
    'zh-cn': 'Simplified Chinese',
    'zh-tw': 'Traditional Chinese',
    zh: 'Chinese',
    ja: 'Japanese',
    en: 'English',
    ko: 'Korean',
    fr: 'French',
    de: 'German',
    es: 'Spanish',
    ru: 'Russian',
  };
  return map[value.toLowerCase()] ?? value;
}

function buildChatCompletionsUrl(baseUrl: string) {
  const normalized = normalizeBaseUrl(baseUrl);
  if (normalized.endsWith('/chat/completions')) return normalized;
  return `${normalized}/chat/completions`;
}

function extractJsonArray(content: string): string[] | null {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? trimmed).trim();

  const tryParse = (raw: string) => {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.every(item => typeof item === 'string')) {
      return parsed as string[];
    }
    if (
      parsed &&
      typeof parsed === 'object' &&
      Array.isArray((parsed as { translations?: unknown }).translations) &&
      (parsed as { translations: unknown[] }).translations.every(item => typeof item === 'string')
    ) {
      return (parsed as { translations: string[] }).translations;
    }
    return null;
  };

  try {
    return tryParse(candidate);
  } catch {
    const start = candidate.indexOf('[');
    const end = candidate.lastIndexOf(']');
    if (start >= 0 && end > start) {
      try {
        return tryParse(candidate.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

type ChatCompletionResponse = {
  choices?: Array<{
    message?: { content?: string | null };
  }>;
  error?: { message?: string; type?: string; code?: string | number };
};

async function callChatCompletions(options: {
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  system: string;
  user: string;
}) {
  const url = buildChatCompletionsUrl(options.baseUrl);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${options.apiKey}`,
    },
    body: JSON.stringify({
      model: options.model,
      temperature: options.temperature,
      messages: [
        { role: 'system', content: options.system },
        { role: 'user', content: options.user },
      ],
    }),
  });

  let json: ChatCompletionResponse;
  try {
    json = (await response.json()) as ChatCompletionResponse;
  } catch {
    throw new LlmTranslateError(`LLM 响应不是 JSON (HTTP ${response.status})`, {
      status: response.status,
      retryable: isRetryableStatus(response.status),
    });
  }

  if (!response.ok || json.error) {
    const message = json.error?.message || `LLM 请求失败 (HTTP ${response.status})`;
    throw new LlmTranslateError(message, {
      status: response.status,
      retryable: isRetryableStatus(response.status),
    });
  }

  const content = json.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new LlmTranslateError('LLM 返回空内容', { status: response.status, retryable: true });
  }

  return content;
}

async function withRetry<T>(label: string, run: () => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
      const retryable =
        error instanceof LlmTranslateError
          ? error.retryable
          : /econnreset|etimedout|network|fetch failed|socket/i.test(errorMessage(error));

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

function buildPrompt(params: {
  previous: string[];
  focusTexts: string[];
  from?: string;
  to: string;
}) {
  const system = [
    'You are a professional subtitle translator.',
    'Translate dialogue naturally and keep speaker tone.',
    'Preserve names, onomatopoeia, and line breaks inside a cue when present.',
    'Do not add explanations.',
    'Return ONLY a JSON array of strings for the lines that must be translated, in the same order and length.',
  ].join(' ');

  const lines: string[] = [
    `Source language: ${languageLabel(params.from)}`,
    `Target language: ${languageLabel(params.to)}`,
    '',
  ];

  if (params.previous.length > 0) {
    lines.push('Previous context (for disambiguation only, DO NOT translate):');
    params.previous.forEach((text, i) => {
      lines.push(`${i + 1}. ${text}`);
    });
    lines.push('');
  }

  lines.push('Translate the following subtitle lines.');
  lines.push(`Return a JSON array with exactly ${params.focusTexts.length} strings.`);
  lines.push('Lines:');
  params.focusTexts.forEach((text, i) => {
    lines.push(`${i + 1}. ${text}`);
  });

  return { system, user: lines.join('\n') };
}

async function translateWindowWithLlm(
  texts: string[],
  start: number,
  windowSize: number,
  previousLimit: number,
  options: {
    to: string;
    from?: string;
    baseUrl: string;
    apiKey: string;
    model: string;
    temperature: number;
  }
) {
  const end = Math.min(texts.length, start + Math.max(1, Math.floor(windowSize)));
  const focusTexts = texts.slice(start, end);
  const results = [...focusTexts];

  const nonemptyFocusIndexes: number[] = [];
  focusTexts.forEach((text, i) => {
    if (text.trim()) nonemptyFocusIndexes.push(i);
  });
  if (nonemptyFocusIndexes.length === 0) return results;

  const previous = collectPreviousContext(texts, start, Math.max(0, Math.floor(previousLimit)));
  // 只把非空焦点句送给模型，空行原样保留
  const nonemptyFocus = nonemptyFocusIndexes.map(i => focusTexts[i] ?? '');
  const { system, user } = buildPrompt({
    previous,
    focusTexts: nonemptyFocus,
    from: options.from,
    to: options.to,
  });

  const content = await callChatCompletions({
    baseUrl: options.baseUrl,
    apiKey: options.apiKey,
    model: options.model,
    temperature: options.temperature,
    system,
    user,
  });

  const translated = extractJsonArray(content);
  if (!translated || translated.length !== nonemptyFocus.length) {
    throw new LlmTranslateError(
      `LLM 返回条数不匹配: expect ${nonemptyFocus.length}, got ${translated?.length ?? 0}`,
      { retryable: true }
    );
  }

  nonemptyFocusIndexes.forEach((focusIndex, i) => {
    results[focusIndex] = translated[i] ?? focusTexts[focusIndex] ?? '';
  });

  return results;
}

export function isLlmConfigured(settings: {
  llmEnabled: boolean;
  llmBaseUrl: string;
  llmApiKey: string;
  llmModel: string;
}) {
  return Boolean(
    settings.llmEnabled &&
    settings.llmBaseUrl.trim() &&
    settings.llmApiKey.trim() &&
    settings.llmModel.trim()
  );
}

export async function translateTextsWithLlm(texts: string[], options: LlmTranslateOptions) {
  const {
    to,
    from,
    onProgress,
    contextWindowSize = DEFAULT_WINDOW_SIZE,
    contextPreviousSize = DEFAULT_PREVIOUS_SIZE,
  } = options;
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const apiKey = options.apiKey.trim();
  const model = options.model.trim();
  const temperature =
    typeof options.temperature === 'number' && Number.isFinite(options.temperature)
      ? Math.min(2, Math.max(0, options.temperature))
      : 0.2;
  const batchGapMs =
    typeof options.batchGapMs === 'number' && Number.isFinite(options.batchGapMs)
      ? Math.max(0, Math.round(options.batchGapMs))
      : 0;

  if (!baseUrl || !apiKey || !model) {
    throw new LlmTranslateError('LLM 未完整配置（需要 baseUrl / apiKey / model）');
  }

  if (texts.length === 0) return [];

  logger.info(
    `翻译 Provider: LLM（OpenAI 兼容） model=${model} baseUrl=${baseUrl} cues=${texts.length}`
  );

  const windowSize = Math.max(1, Math.floor(contextWindowSize));
  const previousSize = Math.max(0, Math.floor(contextPreviousSize));
  const output: string[] = new Array(texts.length);
  let done = 0;

  for (let start = 0; start < texts.length; start += windowSize) {
    const chunkSize = Math.min(windowSize, texts.length - start);
    const translated = await withRetry(
      `LLM 翻译窗口 ${start + 1}-${start + chunkSize}/${texts.length}`,
      () =>
        translateWindowWithLlm(texts, start, windowSize, previousSize, {
          to,
          from,
          baseUrl,
          apiKey,
          model,
          temperature,
        })
    );

    translated.forEach((text, i) => {
      output[start + i] = text;
    });

    done += chunkSize;
    await onProgress?.(done, texts.length);

    if (start + windowSize < texts.length && batchGapMs > 0) {
      await sleep(batchGapMs);
    }
  }

  return output;
}
