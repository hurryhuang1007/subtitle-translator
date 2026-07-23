import { protectAssTags, restoreAssTags } from './assTags';
import { SubtitleParseError, type ParsedSubtitle, type TranslatableCue } from './types';

type DialogueEvent = {
  prefix: string;
  rawText: string;
  cueIndex: number | null;
};

function normalizeNewlines(content: string) {
  return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function splitDialogue(line: string) {
  // Dialogue: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
  const match = /^(Dialogue:\s*[^,]*,[^,]*,[^,]*,[^,]*,[^,]*,[^,]*,[^,]*,[^,]*,[^,]*,)(.*)$/i.exec(
    line
  );
  if (!match) {
    return null;
  }
  return {
    prefix: match[1] ?? '',
    text: match[2] ?? '',
  };
}

function toTranslatableAssText(rawText: string) {
  const { protectedText } = protectAssTags(rawText);
  return protectedText.replace(/\\[nN]/g, '\n').replace(/\\h/g, ' ');
}

function fromTranslatedAssText(rawText: string, translated: string) {
  const { tags, protectedText } = protectAssTags(rawText);

  // 译文仍带占位符：直接还原
  if (/\uE000\d+\uE001/.test(translated)) {
    return restoreAssTags(translated.replace(/\n/g, '\\N'), tags);
  }

  // 译文为纯文本：按原文标签骨架，把文本槽位按顺序替换
  const parts = protectedText.split(/(\uE000\d+\uE001|\\[nN])/);
  const translatedLines = translated.split('\n');
  let lineIndex = 0;

  const merged = parts
    .map(part => {
      if (!part) return part;
      if (/^\uE000\d+\uE001$/.test(part) || /^\\[nN]$/.test(part)) {
        return part;
      }
      const next = translatedLines[lineIndex] ?? '';
      lineIndex += 1;
      return next;
    })
    .join('');

  const remainder = translatedLines.slice(lineIndex).join('\\N');
  const withRemainder = remainder ? `${merged}\\N${remainder}` : merged;
  return restoreAssTags(withRemainder, tags);
}

function hasVisibleText(rawText: string) {
  return (
    rawText
      .replace(/\{[^}]*\}/g, '')
      .replace(/\\[nN]/g, '')
      .replace(/\\h/g, '')
      .trim().length > 0
  );
}

export function parseAss(content: string, format: 'ass' | 'ssa' = 'ass'): ParsedSubtitle {
  const normalized = normalizeNewlines(content);
  if (!normalized.trim()) {
    throw new SubtitleParseError('ASS 内容为空');
  }

  const lines = normalized.split('\n');
  const events: DialogueEvent[] = [];
  const cues: TranslatableCue[] = [];

  for (const line of lines) {
    if (!/^Dialogue:/i.test(line)) {
      events.push({ prefix: line, rawText: '', cueIndex: null });
      continue;
    }

    const dialogue = splitDialogue(line);
    if (!dialogue) {
      events.push({ prefix: line, rawText: '', cueIndex: null });
      continue;
    }

    if (!hasVisibleText(dialogue.text)) {
      events.push({ prefix: dialogue.prefix, rawText: dialogue.text, cueIndex: null });
      continue;
    }

    const cueIndex = cues.length;
    cues.push({
      id: `${format}-${cueIndex}`,
      text: toTranslatableAssText(dialogue.text),
    });
    events.push({
      prefix: dialogue.prefix,
      rawText: dialogue.text,
      cueIndex,
    });
  }

  return {
    format,
    cues,
    rebuild(translatedTexts: string[]) {
      if (translatedTexts.length !== cues.length) {
        throw new SubtitleParseError(
          `ASS 翻译条数不匹配: expect ${cues.length}, got ${translatedTexts.length}`
        );
      }

      return events
        .map(event => {
          if (event.cueIndex == null) {
            return event.prefix + event.rawText;
          }
          const translated = translatedTexts[event.cueIndex] ?? '';
          return event.prefix + fromTranslatedAssText(event.rawText, translated);
        })
        .join('\n');
    },
  };
}
