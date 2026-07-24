import { bootstrapServer } from '@/server/bootstrap';
import { getSettings, updateSettings, type AppSettings } from '@/server/config/settings';
import { apiFail, apiOk } from '@/server/util/apiResponse';

function normalizeSettingsInput(body: Partial<AppSettings>) {
  const next: Partial<AppSettings> = {};

  if (body.watchDirs !== undefined) {
    if (!Array.isArray(body.watchDirs)) {
      throw new Error('watchDirs 必须是字符串数组');
    }
    const dirs = body.watchDirs.map(item => String(item).trim()).filter(Boolean);
    if (dirs.length === 0) {
      throw new Error('至少配置一个监听目录');
    }
    next.watchDirs = dirs;
  }

  if (body.filenamePattern !== undefined) {
    const pattern = String(body.filenamePattern).trim();
    if (pattern) {
      try {
        RegExp(pattern, 'i');
      } catch {
        throw new Error('filenamePattern 不是合法正则表达式');
      }
    }
    next.filenamePattern = pattern;
  }

  if (body.targetLanguage !== undefined) {
    const language = String(body.targetLanguage).trim();
    if (!language) throw new Error('targetLanguage 不能为空');
    next.targetLanguage = language;
  }

  if (body.outputSuffixTemplate !== undefined) {
    const suffix = String(body.outputSuffixTemplate).trim();
    if (!suffix) throw new Error('outputSuffixTemplate 不能为空');
    next.outputSuffixTemplate = suffix;
  }

  if (body.debounceMs !== undefined) {
    const debounceMs = Number(body.debounceMs);
    if (!Number.isFinite(debounceMs) || debounceMs < 100) {
      throw new Error('debounceMs 需为不小于 100 的数字');
    }
    next.debounceMs = Math.round(debounceMs);
  }

  if (body.queueConcurrency !== undefined) {
    const queueConcurrency = Number(body.queueConcurrency);
    if (!Number.isFinite(queueConcurrency) || queueConcurrency < 1) {
      throw new Error('queueConcurrency 需为不小于 1 的数字');
    }
    next.queueConcurrency = Math.min(32, Math.round(queueConcurrency));
  }

  if (body.batchGapMs !== undefined) {
    const batchGapMs = Number(body.batchGapMs);
    if (!Number.isFinite(batchGapMs) || batchGapMs < 0) {
      throw new Error('batchGapMs 需为不小于 0 的数字');
    }
    next.batchGapMs = Math.min(60_000, Math.round(batchGapMs));
  }

  if (body.autoStart !== undefined) {
    next.autoStart = Boolean(body.autoStart);
  }

  if (body.skipIfExists !== undefined) {
    next.skipIfExists = Boolean(body.skipIfExists);
  }

  if (body.googleApiKey !== undefined) {
    next.googleApiKey = String(body.googleApiKey);
  }

  return next;
}

export async function GET() {
  await bootstrapServer();
  const settings = await getSettings();
  return apiOk(settings);
}

export async function PUT(request: Request) {
  await bootstrapServer();

  try {
    const body = (await request.json()) as Partial<AppSettings>;
    const normalized = normalizeSettingsInput(body);
    const settings = await updateSettings(normalized);
    return apiOk(settings);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return apiFail(message);
  }
}
