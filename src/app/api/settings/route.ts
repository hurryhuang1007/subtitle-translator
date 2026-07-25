import { getSettings, updateSettings, type AppSettings } from '@/server/config/settings';
import { apiFail, apiOk } from '@/server/util/apiResponse';

function requirePositiveInt(value: unknown, field: string, min = 1) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < min) {
    throw new Error(`${field} 需为不小于 ${min} 的数字`);
  }
  return Math.round(num);
}

function requireNonNegativeInt(value: unknown, field: string) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    throw new Error(`${field} 需为不小于 0 的数字`);
  }
  return Math.round(num);
}

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

  if (body.sourceLanguage !== undefined) {
    const language = String(body.sourceLanguage).trim() || 'auto';
    next.sourceLanguage = language;
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

  if (body.translateMaxRetries !== undefined) {
    const translateMaxRetries = requireNonNegativeInt(
      body.translateMaxRetries,
      'translateMaxRetries'
    );
    next.translateMaxRetries = Math.min(30, translateMaxRetries);
  }

  if (body.contextAwareTranslate !== undefined) {
    next.contextAwareTranslate = Boolean(body.contextAwareTranslate);
  }

  if (body.contextWindowSize !== undefined) {
    next.contextWindowSize = requirePositiveInt(body.contextWindowSize, 'contextWindowSize');
  }

  if (body.contextPreviousSize !== undefined) {
    next.contextPreviousSize = requireNonNegativeInt(
      body.contextPreviousSize,
      'contextPreviousSize'
    );
  }

  if (body.shrinkWindowOnRateLimit !== undefined) {
    next.shrinkWindowOnRateLimit = Boolean(body.shrinkWindowOnRateLimit);
  }

  if (body.shrinkWindowRetries !== undefined) {
    next.shrinkWindowRetries = requireNonNegativeInt(
      body.shrinkWindowRetries,
      'shrinkWindowRetries'
    );
  }

  if (body.shrinkWindowMinSize !== undefined) {
    next.shrinkWindowMinSize = requirePositiveInt(body.shrinkWindowMinSize, 'shrinkWindowMinSize');
  }

  if (body.shrinkPreviousMinSize !== undefined) {
    next.shrinkPreviousMinSize = requireNonNegativeInt(
      body.shrinkPreviousMinSize,
      'shrinkPreviousMinSize'
    );
  }

  if (body.forceBatch !== undefined) {
    next.forceBatch = Boolean(body.forceBatch);
  }

  if (body.autoStart !== undefined) {
    next.autoStart = Boolean(body.autoStart);
  }

  if (body.translationEnabled !== undefined) {
    next.translationEnabled = Boolean(body.translationEnabled);
  }

  if (body.skipIfExists !== undefined) {
    next.skipIfExists = Boolean(body.skipIfExists);
  }

  if (body.googleApiKey !== undefined) {
    next.googleApiKey = String(body.googleApiKey);
  }

  if (body.llmEnabled !== undefined) {
    next.llmEnabled = Boolean(body.llmEnabled);
  }

  if (body.llmBaseUrl !== undefined) {
    next.llmBaseUrl = String(body.llmBaseUrl).trim();
  }

  if (body.llmApiKey !== undefined) {
    next.llmApiKey = String(body.llmApiKey);
  }

  if (body.llmModel !== undefined) {
    next.llmModel = String(body.llmModel).trim();
  }

  if (body.llmTemperature !== undefined) {
    const llmTemperature = Number(body.llmTemperature);
    if (!Number.isFinite(llmTemperature) || llmTemperature < 0 || llmTemperature > 2) {
      throw new Error('llmTemperature 需为 0–2 之间的数字');
    }
    next.llmTemperature = llmTemperature;
  }

  if (body.llmMaxRetries !== undefined) {
    const llmMaxRetries = requireNonNegativeInt(body.llmMaxRetries, 'llmMaxRetries');
    next.llmMaxRetries = Math.min(30, llmMaxRetries);
  }

  if (body.llmContextWindowSize !== undefined) {
    next.llmContextWindowSize = requirePositiveInt(
      body.llmContextWindowSize,
      'llmContextWindowSize'
    );
  }

  if (body.llmContextPreviousSize !== undefined) {
    next.llmContextPreviousSize = requireNonNegativeInt(
      body.llmContextPreviousSize,
      'llmContextPreviousSize'
    );
  }

  if (body.llmFallbackToMachine !== undefined) {
    next.llmFallbackToMachine = Boolean(body.llmFallbackToMachine);
  }

  return next;
}

export async function GET() {
  const settings = await getSettings();
  return apiOk(settings);
}

export async function PUT(request: Request) {
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
