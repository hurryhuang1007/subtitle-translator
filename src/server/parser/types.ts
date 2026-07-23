export type SubtitleFormat = 'srt' | 'ass' | 'ssa';

export type TranslatableCue = {
  id: string;
  text: string;
};

export type ParsedSubtitle = {
  format: SubtitleFormat;
  cues: TranslatableCue[];
  /** 用翻译结果重建字幕文件内容 */
  rebuild: (translatedTexts: string[]) => string;
};

export class SubtitleParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SubtitleParseError';
  }
}
