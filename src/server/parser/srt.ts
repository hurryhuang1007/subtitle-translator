import { SubtitleParseError, type ParsedSubtitle, type TranslatableCue } from './types';

type SrtBlock = {
  index: string;
  time: string;
  lines: string[];
};

function normalizeNewlines(content: string) {
  return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function parseBlocks(content: string): SrtBlock[] {
  const normalized = normalizeNewlines(content).trim();
  if (!normalized) {
    return [];
  }

  const chunks = normalized.split(/\n{2,}/);
  const blocks: SrtBlock[] = [];

  for (const chunk of chunks) {
    const lines = chunk.split('\n').filter((line, idx, arr) => {
      // 保留中间空行语义：时间轴后的文本行可有多行
      return !(idx === arr.length - 1 && line.trim() === '');
    });

    if (lines.length < 2) {
      continue;
    }

    const first = lines[0]?.trim() ?? '';
    const second = lines[1]?.trim() ?? '';
    const hasIndex = /^\d+$/.test(first);
    const timeLine = hasIndex ? second : first;
    const textLines = hasIndex ? lines.slice(2) : lines.slice(1);

    if (!/-->/.test(timeLine)) {
      throw new SubtitleParseError(`无效的 SRT 时间轴: ${timeLine}`);
    }

    blocks.push({
      index: hasIndex ? first : String(blocks.length + 1),
      time: timeLine,
      lines: textLines,
    });
  }

  return blocks;
}

export function parseSrt(content: string): ParsedSubtitle {
  const blocks = parseBlocks(content);
  const cues: TranslatableCue[] = blocks.map((block, index) => ({
    id: `srt-${index}`,
    text: block.lines.join('\n'),
  }));

  return {
    format: 'srt',
    cues,
    rebuild(translatedTexts: string[]) {
      if (translatedTexts.length !== blocks.length) {
        throw new SubtitleParseError(
          `SRT 翻译条数不匹配: expect ${blocks.length}, got ${translatedTexts.length}`
        );
      }

      return blocks
        .map((block, index) => {
          const text = translatedTexts[index] ?? '';
          return `${block.index}\n${block.time}\n${text}`.trimEnd();
        })
        .join('\n\n')
        .concat('\n');
    },
  };
}
