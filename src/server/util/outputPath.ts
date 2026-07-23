import path from 'node:path';

import type { AppSettings } from '@/server/config/settings';

const SUBTITLE_EXTS = new Set(['.srt', '.ass', '.ssa']);

export function isSubtitleFile(filePath: string) {
  return SUBTITLE_EXTS.has(path.extname(filePath).toLowerCase());
}

/** zh-CN -> zh；en -> en */
export function languageTag(targetLanguage: string) {
  const normalized = targetLanguage.trim().toLowerCase();
  if (!normalized) return 'zh';
  return normalized.split(/[-_]/)[0] || 'zh';
}

export function resolveOutputSuffix(settings: AppSettings) {
  const lang = languageTag(settings.targetLanguage);
  return settings.outputSuffixTemplate.replaceAll('{lang}', lang);
}

export function resolveOutputPath(inputPath: string, settings: AppSettings) {
  const ext = path.extname(inputPath);
  const base = inputPath.slice(0, -ext.length);
  const suffix = resolveOutputSuffix(settings);
  return `${base}${suffix}${ext}`;
}

/** 已是目标输出文件时跳过，避免翻译结果再次入队 */
export function isAlreadyTranslatedOutput(filePath: string, settings: AppSettings) {
  const ext = path.extname(filePath).toLowerCase();
  if (!SUBTITLE_EXTS.has(ext)) return false;

  const suffix = resolveOutputSuffix(settings).toLowerCase();
  const name = path.basename(filePath, ext).toLowerCase();
  return name.endsWith(suffix.toLowerCase());
}
