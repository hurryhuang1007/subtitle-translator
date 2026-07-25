import { SubtitleParseError } from '@/server/parser/types';
import { CloudTranslateError } from '@/server/translator/cloudTranslate';
import { LlmTranslateError } from '@/server/translator/llmTranslate';

/** 机器翻译阶段抛出的可读错误（已带中文说明与上下文） */
export class MachineTranslateError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'MachineTranslateError';
    if (options?.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

function rawMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

function truncate(text: string, max = 180) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max)}…`;
}

/** 把上游英文/技术错误压成用户可读原因 */
export function describeTranslateCause(error: unknown): string {
  const raw = rawMessage(error);
  const lower = raw.toLowerCase();

  if (
    lower.includes('partial translation request fail') ||
    lower.includes('rejected by the server')
  ) {
    return '免费 Google 翻译接口拒绝了部分或全部请求（多为限流/风控）。可稍后重试、增大请求间隔，或配置 Google API Key 改走 Cloud Translation';
  }

  if (
    lower.includes('too many requests') ||
    lower.includes('rate limit') ||
    lower.includes('ratelimit') ||
    lower.includes('429')
  ) {
    return '翻译接口限流（请求过于频繁）。请增大「批次间隔」后重试，或配置 Google API Key';
  }

  if (
    lower.includes('econnreset') ||
    lower.includes('etimedout') ||
    lower.includes('network') ||
    lower.includes('fetch failed') ||
    lower.includes('socket') ||
    lower.includes('enotfound') ||
    lower.includes('eai_again')
  ) {
    return `网络异常，无法连接翻译服务（${truncate(raw, 80)}）`;
  }

  if (
    lower.includes('unauthorized') ||
    lower.includes('invalid api key') ||
    lower.includes('403')
  ) {
    return '翻译鉴权失败，请检查 Google API Key 是否正确、是否已启用 Cloud Translation API';
  }

  if (lower.includes('quota') || lower.includes('billing')) {
    return '翻译配额不足或计费异常，请检查 Google Cloud 配额与账单';
  }

  // 已是中文短句则直接用
  if (/[\u4e00-\u9fff]/.test(raw) && raw.length <= 200) {
    return raw;
  }

  return `上游返回: ${truncate(raw)}`;
}

export function formatMachineTranslateError(options: {
  provider: 'free' | 'cloud';
  scope: string;
  error: unknown;
}) {
  const providerLabel = options.provider === 'cloud' ? 'Google Cloud 翻译' : '免费 Google 翻译';
  return `${providerLabel}失败（${options.scope}）: ${describeTranslateCause(options.error)}`;
}

/** 写入任务 error 字段 / 展示给用户的最终文案 */
export function formatTaskError(error: unknown): string {
  if (error instanceof SubtitleParseError) {
    return `字幕解析失败: ${error.message}`;
  }
  if (error instanceof MachineTranslateError) {
    return error.message;
  }
  if (error instanceof CloudTranslateError) {
    const status = error.status ? ` HTTP ${error.status}` : '';
    return `Google Cloud 翻译失败${status}: ${describeTranslateCause(error)}`;
  }
  if (error instanceof LlmTranslateError) {
    const status = error.status ? ` HTTP ${error.status}` : '';
    return `大模型翻译失败${status}: ${truncate(error.message)}`;
  }

  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : '';
  if (code === 'ENOENT') {
    return '找不到字幕源文件，可能已被移动或删除';
  }
  if (code === 'EACCES' || code === 'EPERM') {
    return '无权限读写字幕文件，请检查目录权限';
  }

  return describeTranslateCause(error);
}
