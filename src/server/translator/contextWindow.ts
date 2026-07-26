export type ContextWindow = {
  start: number;
  end: number;
  focusTexts: string[];
  previous: string[];
  focusChars: number;
  previousChars: number;
};

/**
 * 正文优先构造翻译窗口：先按句数/字符数截取焦点句，再用剩余字符额度携带最近的上文。
 * 单句本身超过字符上限时仍会保留，避免队列无法前进。
 */
export function buildContextWindow(options: {
  texts: string[];
  start: number;
  maxFocusItems: number;
  maxPreviousItems: number;
  maxChars: number;
}): ContextWindow {
  const { texts } = options;
  const start = Math.max(0, Math.floor(options.start));
  const maxFocusItems = Math.max(1, Math.floor(options.maxFocusItems));
  const maxPreviousItems = Math.max(0, Math.floor(options.maxPreviousItems));
  const maxChars = Math.max(1, Math.floor(options.maxChars));

  let end = start;
  let focusChars = 0;
  while (end < texts.length && end - start < maxFocusItems) {
    const size = (texts[end] ?? '').length;
    if (end > start && focusChars + size > maxChars) {
      break;
    }
    focusChars += size;
    end += 1;
  }

  const previous: string[] = [];
  let previousChars = 0;
  const remainingChars = Math.max(0, maxChars - focusChars);
  for (let index = start - 1; index >= 0 && previous.length < maxPreviousItems; index -= 1) {
    const text = texts[index] ?? '';
    if (!text.trim()) continue;
    if (previousChars + text.length > remainingChars) {
      break;
    }
    previous.unshift(text);
    previousChars += text.length;
  }

  return {
    start,
    end,
    focusTexts: texts.slice(start, end),
    previous,
    focusChars,
    previousChars,
  };
}
