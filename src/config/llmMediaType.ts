/** 预设影片类型；空字符串表示不选择、不注入场景提示词 */
export type LlmMediaTypePreset = '' | 'anime' | 'movie' | 'tv' | 'documentary' | 'variety';

/** 下拉选项值：含 UI 专用的 custom */
export type LlmMediaTypeSelect = LlmMediaTypePreset | 'custom';

export const LLM_MEDIA_TYPE_OPTIONS: Array<{ value: LlmMediaTypeSelect; label: string }> = [
  { value: '', label: '不选择' },
  { value: 'anime', label: '动画 / 番剧' },
  { value: 'movie', label: '电影' },
  { value: 'tv', label: '电视剧' },
  { value: 'documentary', label: '纪录片' },
  { value: 'variety', label: '综艺' },
  { value: 'custom', label: '自定义…' },
];

const LLM_MEDIA_TYPE_PRESETS = new Set<string>(
  LLM_MEDIA_TYPE_OPTIONS.filter(option => option.value !== 'custom').map(option => option.value)
);

const LLM_MEDIA_TYPE_PROMPTS: Record<Exclude<LlmMediaTypePreset, ''>, string> = {
  anime:
    'Content type: anime. Prefer natural, character-driven dialogue; keep honorifics and nicknames when they carry tone; preserve onomatopoeia and playful/exaggerated speech; do not over-localize into stiff literary Chinese.',
  movie:
    'Content type: feature film. Prefer cinematic, concise subtitle style; keep emotional beats and register (formal/casual) consistent with the scene; avoid overly explanatory expansions.',
  tv: 'Content type: TV drama. Prefer conversational, episode-friendly wording; keep recurring character speech patterns consistent; balance natural spoken Chinese with subtitle brevity.',
  documentary:
    'Content type: documentary. Prefer clear, factual, neutral phrasing; keep terminology consistent; do not add dramatic embellishment beyond the source.',
  variety:
    'Content type: variety / talk show. Prefer lively spoken Chinese; preserve jokes, banter, and host/guest register; keep catchphrases recognizable when possible.',
};

const MAX_CUSTOM_MEDIA_TYPE_LENGTH = 200;

export function resolveLlmMediaTypeSelect(value: string) {
  const normalized = value.trim();
  if (LLM_MEDIA_TYPE_PRESETS.has(normalized)) {
    return { select: normalized as LlmMediaTypePreset, custom: '' };
  }
  if (!normalized || normalized === 'custom') {
    return { select: '' as const, custom: '' };
  }
  return { select: 'custom' as const, custom: normalized };
}

/** 规范化保存值：空 / 预设 / 自定义文案；过长截断 */
export function normalizeLlmMediaType(value: unknown) {
  const raw = String(value ?? '').trim();
  if (!raw || raw === 'custom') return '';
  if (raw.length > MAX_CUSTOM_MEDIA_TYPE_LENGTH) {
    throw new Error(`llmMediaType 最长 ${MAX_CUSTOM_MEDIA_TYPE_LENGTH} 个字符`);
  }
  return raw;
}

/** 有选择时返回注入 system 的场景提示；未选择返回 null */
export function resolveLlmMediaTypePrompt(mediaType?: string | null) {
  const value = mediaType?.trim() ?? '';
  if (!value || value === 'custom') {
    return null;
  }
  if (value in LLM_MEDIA_TYPE_PROMPTS) {
    return LLM_MEDIA_TYPE_PROMPTS[value as Exclude<LlmMediaTypePreset, ''>];
  }
  return `Content type: ${value}. Adapt translation style, register, terminology, and tone to this content type while keeping natural, concise subtitle wording.`;
}
