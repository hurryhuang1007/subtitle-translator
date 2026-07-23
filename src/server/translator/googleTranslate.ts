import translate from 'google-translate-api-x';

import { logger } from '@/server/logger/logger';

const MAX_CHARS_PER_BATCH = 4500;
const MAX_ITEMS_PER_BATCH = 40;
const BATCH_GAP_MS = 400;

export type TranslateTextsOptions = {
  to: string;
  onProgress?: (done: number, total: number) => void | Promise<void>;
};

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function buildBatches(texts: string[]) {
  const batches: string[][] = [];
  let current: string[] = [];
  let currentChars = 0;

  for (const text of texts) {
    const size = text.length || 1;
    const exceedItems = current.length >= MAX_ITEMS_PER_BATCH;
    const exceedChars = current.length > 0 && currentChars + size > MAX_CHARS_PER_BATCH;

    if (exceedItems || exceedChars) {
      batches.push(current);
      current = [];
      currentChars = 0;
    }

    current.push(text);
    currentChars += size;
  }

  if (current.length > 0) {
    batches.push(current);
  }

  return batches;
}

async function translateBatch(texts: string[], to: string) {
  if (texts.length === 0) return [] as string[];

  // 空串直接保留，避免无意义请求
  const indexMap: number[] = [];
  const payload: string[] = [];
  texts.forEach((text, index) => {
    if (text.trim()) {
      indexMap.push(index);
      payload.push(text);
    }
  });

  const results = [...texts];
  if (payload.length === 0) {
    return results;
  }

  const response = await translate(payload, {
    to,
    forceBatch: true,
  } as Parameters<typeof translate>[1]);

  const list = Array.isArray(response) ? response : [response];
  list.forEach((item, i) => {
    const originalIndex = indexMap[i];
    if (originalIndex == null) return;
    results[originalIndex] = item.text;
  });

  return results;
}

export async function translateTexts(texts: string[], options: TranslateTextsOptions) {
  const { to, onProgress } = options;
  if (texts.length === 0) {
    return [];
  }

  const batches = buildBatches(texts);
  const output: string[] = [];
  let done = 0;

  for (let i = 0; i < batches.length; i += 1) {
    const batch = batches[i] ?? [];
    try {
      const translated = await translateBatch(batch, to);
      output.push(...translated);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`翻译批次失败 (${i + 1}/${batches.length}): ${message}`);
      throw error;
    }

    done += batch.length;
    await onProgress?.(done, texts.length);

    if (i < batches.length - 1) {
      await sleep(BATCH_GAP_MS);
    }
  }

  return output;
}
