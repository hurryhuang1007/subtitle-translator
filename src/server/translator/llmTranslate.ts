import { resolveLlmMediaTypePrompt } from '@/config/llmMediaType';
import { logger } from '@/server/logger/logger';
import { buildContextWindow, type ContextWindow } from '@/server/translator/contextWindow';
import { isProd } from '@/util/env';

const DEFAULT_WINDOW_SIZE = 30;
const DEFAULT_PREVIOUS_SIZE = 5;
const DEFAULT_WINDOW_MAX_CHARS = 1500;
const DEFAULT_MAX_RETRIES = 5;
const DEFAULT_MAX_TOKENS_INPUT_MULTIPLIER = 3;
const RETRY_BASE_DELAY_MS = 1000;
const RETRY_MAX_DELAY_MS = 20_000;

export type LlmFailedWindowFallback = (params: {
  texts: string[];
  start: number;
  end: number;
  error: unknown;
}) => Promise<string[]>;

export type LlmTranslateOptions = {
  to: string;
  from?: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature?: number;
  /**
   * max_tokens = 本轮请求输入字符数 × 该倍数，默认 3。
   */
  maxTokensInputMultiplier?: number;
  /** 可重试错误的最大重试次数（不含首次），默认 5 */
  maxRetries?: number;
  batchGapMs?: number;
  contextWindowSize?: number;
  contextPreviousSize?: number;
  /** 单次窗口原文字符数上限（焦点句优先），默认 1500 */
  contextWindowMaxChars?: number;
  /** 影片类型；空或不传则不注入场景提示词 */
  mediaType?: string;
  /**
   * 某次窗口在重试耗尽后仍失败时调用；返回该窗口译文后继续后续窗口。
   * 未提供或回调再抛错时，整次 LLM 翻译失败。
   */
  onFailedWindow?: LlmFailedWindowFallback;
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

const THINKING_BLOCK_RE = /<(think|thinking|analysis|reasoning)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;

export function stripThinkingContent(content: string) {
  return content.replace(THINKING_BLOCK_RE, '').trim();
}

function extractJsonArray(content: string): string[] | null {
  const trimmed = stripThinkingContent(content);
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
  maxTokens: number;
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
      max_tokens: options.maxTokens,
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

async function withRetry<T>(label: string, run: () => Promise<T>, maxRetries: number): Promise<T> {
  let lastError: unknown;
  const retries = Math.max(0, Math.floor(maxRetries));

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
      const retryable =
        error instanceof LlmTranslateError
          ? error.retryable
          : /econnreset|etimedout|network|fetch failed|socket/i.test(errorMessage(error));

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

function buildPrompt(params: {
  previous: string[];
  focusTexts: string[];
  from?: string;
  to: string;
  mediaType?: string;
}) {
  const expectedCount = params.focusTexts.length;
  const mediaPrompt = resolveLlmMediaTypePrompt(params.mediaType);
  const system = [
    'You are a professional subtitle translator.',
    'Translate dialogue naturally and keep speaker tone.',
    'Preserve names, onomatopoeia, and line breaks inside a cue when present.',
    'Do not add explanations.',
    'Do not include any reasoning, chain-of-thought, or thinking process in the output — return only the final JSON array.',
    'Return ONLY a JSON array of strings for the lines that must be translated, in the same order.',
    'CRITICAL: the array length MUST equal the number of input lines exactly — never more, never fewer.',
    'If you merge multiple input lines into one translation, put the merged text in the first corresponding slot and fill the remaining slots with empty strings "" so the total length still matches.',
    'If a line contains a long run of the same repeated character (e.g. laughter, fillers, punctuation spam), you MAY abbreviate it with "..." in the translation instead of repeating every character.',
    ...(mediaPrompt ? [mediaPrompt] : []),
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
  lines.push(
    `Return a JSON array with EXACTLY ${expectedCount} strings (length must be ${expectedCount}).`
  );
  lines.push(
    'If you combine/merge lines, still output exactly that many items: use "" for unused slots after a merge.'
  );
  lines.push(
    'For long runs of the same repeated character, you may use "..." as an ellipsis abbreviation in the output.'
  );
  lines.push('Lines:');
  params.focusTexts.forEach((text, i) => {
    lines.push(`${i + 1}. ${text}`);
  });

  return { system, user: lines.join('\n') };
}

async function translateWindowWithLlm(
  window: ContextWindow,
  options: {
    to: string;
    from?: string;
    baseUrl: string;
    apiKey: string;
    model: string;
    temperature: number;
    maxTokensInputMultiplier: number;
    mediaType?: string;
  }
) {
  const { focusTexts, previous } = window;
  const results = [...focusTexts];

  const nonemptyFocusIndexes: number[] = [];
  focusTexts.forEach((text, i) => {
    if (text.trim()) nonemptyFocusIndexes.push(i);
  });
  if (nonemptyFocusIndexes.length === 0) return results;

  // 只把非空焦点句送给模型，空行原样保留
  const nonemptyFocus = nonemptyFocusIndexes.map(i => focusTexts[i] ?? '');
  const { system, user } = buildPrompt({
    previous,
    focusTexts: nonemptyFocus,
    from: options.from,
    to: options.to,
    mediaType: options.mediaType,
  });

  const inputChars = system.length + user.length;
  const maxTokens = Math.max(1, Math.ceil(inputChars * options.maxTokensInputMultiplier));

  const content = await callChatCompletions({
    baseUrl: options.baseUrl,
    apiKey: options.apiKey,
    model: options.model,
    temperature: options.temperature,
    maxTokens,
    system,
    user,
  });

  if (!isProd) {
    logger.info(`LLM 返回内容: ${content}`);
  }

  const translated = extractJsonArray(content);
  if (!translated || translated.length !== nonemptyFocus.length) {
    throw new LlmTranslateError(
      [
        `LLM 返回条数不匹配: expect ${nonemptyFocus.length}, got ${translated?.length ?? 0}`,
        `原文: ${JSON.stringify(nonemptyFocus, null, 2)}`,
        `译文: ${JSON.stringify(translated ?? content, null, 2)}`,
      ].join('\n'),
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
    onFailedWindow,
    mediaType,
    contextWindowSize = DEFAULT_WINDOW_SIZE,
    contextPreviousSize = DEFAULT_PREVIOUS_SIZE,
    contextWindowMaxChars = DEFAULT_WINDOW_MAX_CHARS,
    maxRetries = DEFAULT_MAX_RETRIES,
    maxTokensInputMultiplier = DEFAULT_MAX_TOKENS_INPUT_MULTIPLIER,
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
  const retries =
    typeof maxRetries === 'number' && Number.isFinite(maxRetries)
      ? Math.max(0, Math.round(maxRetries))
      : DEFAULT_MAX_RETRIES;
  const tokensMultiplier =
    typeof maxTokensInputMultiplier === 'number' &&
    Number.isFinite(maxTokensInputMultiplier) &&
    maxTokensInputMultiplier > 0
      ? maxTokensInputMultiplier
      : DEFAULT_MAX_TOKENS_INPUT_MULTIPLIER;
  const maxWindowChars =
    typeof contextWindowMaxChars === 'number' &&
    Number.isFinite(contextWindowMaxChars) &&
    contextWindowMaxChars > 0
      ? Math.max(1, Math.floor(contextWindowMaxChars))
      : DEFAULT_WINDOW_MAX_CHARS;

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

  let start = 0;
  while (start < texts.length) {
    const window = buildContextWindow({
      texts,
      start,
      maxFocusItems: windowSize,
      maxPreviousItems: previousSize,
      maxChars: maxWindowChars,
    });
    const end = window.end;
    const chunkSize = end - start;
    const label = `LLM 翻译窗口 ${start + 1}-${end}/${texts.length}`;

    let translated: string[];
    try {
      translated = await withRetry(
        label,
        () =>
          translateWindowWithLlm(window, {
            to,
            from,
            baseUrl,
            apiKey,
            model,
            temperature,
            maxTokensInputMultiplier: tokensMultiplier,
            mediaType,
          }),
        retries
      );
    } catch (error) {
      if (!onFailedWindow) {
        throw error;
      }

      const message = error instanceof Error ? error.message : String(error);
      logger.warn(`${label} 失败，回退该窗口机器翻译: ${message}`);
      translated = await onFailedWindow({ texts, start, end, error });
      if (translated.length !== chunkSize) {
        throw new LlmTranslateError(
          `失败窗口回退译文条数不匹配: expect ${chunkSize}, got ${translated.length}`,
          { retryable: false }
        );
      }
    }

    translated.forEach((text, i) => {
      output[start + i] = text;
    });

    done += chunkSize;
    start = end;
    await onProgress?.(done, texts.length);

    if (start < texts.length && batchGapMs > 0) {
      await sleep(batchGapMs);
    }
  }

  return output;
}
