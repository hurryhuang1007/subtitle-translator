import path from 'node:path';

import { parseAss } from './ass';
import { parseSrt } from './srt';
import { SubtitleParseError, type ParsedSubtitle, type SubtitleFormat } from './types';

export function detectSubtitleFormat(filePath: string): SubtitleFormat {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.srt') return 'srt';
  if (ext === '.ass') return 'ass';
  if (ext === '.ssa') return 'ssa';
  throw new SubtitleParseError(`不支持的字幕格式: ${ext || '(none)'}`);
}

export function parseSubtitleContent(content: string, format: SubtitleFormat): ParsedSubtitle {
  if (format === 'srt') {
    return parseSrt(content);
  }
  return parseAss(content, format);
}

export function parseSubtitleFileContent(filePath: string, content: string): ParsedSubtitle {
  const format = detectSubtitleFormat(filePath);
  return parseSubtitleContent(content, format);
}

export { parseAss, parseSrt, SubtitleParseError };
export type { ParsedSubtitle, SubtitleFormat, TranslatableCue } from './types';
