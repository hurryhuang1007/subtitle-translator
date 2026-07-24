import { logger } from '@/server/logger/logger';

/** Cloud Translation v2：单次请求最多 128 段 */
export const CLOUD_MAX_ITEMS_PER_BATCH = 128;
/** 保守字符上限，避免单请求过大 */
export const CLOUD_MAX_CHARS_PER_BATCH = 25_000;

type CloudTranslation = {
  translatedText: string;
  detectedSourceLanguage?: string;
};

type CloudTranslateSuccess = {
  data?: {
    translations?: CloudTranslation[];
  };
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
};

export class CloudTranslateError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'CloudTranslateError';
    this.status = status;
  }
}

function decodeHtmlEntities(text: string) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#(\d+);/g, (match, code: string) => {
      const num = Number(code);
      return Number.isFinite(num) ? String.fromCodePoint(num) : match;
    });
}

/**
 * Google Cloud Translation API v2（API Key 鉴权）。
 * @see https://cloud.google.com/translate/docs/basic/translating-text
 */
export async function cloudTranslateTexts(
  texts: string[],
  options: { apiKey: string; to: string; from?: string }
) {
  if (texts.length === 0) return [] as string[];

  const url = new URL('https://translation.googleapis.com/language/translate/v2');
  url.searchParams.set('key', options.apiKey);

  const body: Record<string, unknown> = {
    q: texts,
    target: options.to,
    format: 'text',
  };
  if (options.from) {
    body.source = options.from;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  let json: CloudTranslateSuccess;
  try {
    json = (await response.json()) as CloudTranslateSuccess;
  } catch {
    throw new CloudTranslateError(
      `Cloud Translation 响应不是 JSON (HTTP ${response.status})`,
      response.status
    );
  }

  if (!response.ok || json.error) {
    const message = json.error?.message || `Cloud Translation 请求失败 (HTTP ${response.status})`;
    const status = json.error?.code ?? response.status;
    logger.warn(`Cloud Translation 错误: ${message}`);
    throw new CloudTranslateError(message, status);
  }

  const translations = json.data?.translations;
  if (!translations || translations.length !== texts.length) {
    throw new CloudTranslateError(
      `Cloud Translation 返回条数不匹配: expect ${texts.length}, got ${translations?.length ?? 0}`,
      response.status
    );
  }

  return translations.map(item => decodeHtmlEntities(item.translatedText ?? ''));
}
