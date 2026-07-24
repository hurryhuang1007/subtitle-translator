'use client';

import {
  Button,
  Card,
  Field,
  Flex,
  Heading,
  HStack,
  Input,
  NativeSelect,
  Stack,
  Switch,
  Textarea,
  Text,
} from '@chakra-ui/react';
import { useRequest } from 'ahooks';
import { useState } from 'react';

import { toaster } from '@/com/ui/toaster';
import { fetchSettings, updateSettings } from '@/service/settings';
import type { AppSettings } from '@/service/types';

const SOURCE_LANGUAGE_OPTIONS = [
  { value: 'auto', label: '自动检测' },
  { value: 'ja', label: '日语 (ja)' },
  { value: 'en', label: '英语 (en)' },
  { value: 'zh-CN', label: '简体中文 (zh-CN)' },
  { value: 'zh-TW', label: '繁体中文 (zh-TW)' },
  { value: 'ko', label: '韩语 (ko)' },
  { value: 'fr', label: '法语 (fr)' },
  { value: 'de', label: '德语 (de)' },
  { value: 'es', label: '西班牙语 (es)' },
  { value: 'ru', label: '俄语 (ru)' },
  { value: 'custom', label: '自定义…' },
];

type FormState = {
  watchDirsText: string;
  filenamePattern: string;
  sourceLanguage: string;
  sourceLanguageCustom: string;
  targetLanguage: string;
  outputSuffixTemplate: string;
  debounceMs: string;
  queueConcurrency: string;
  batchGapMs: string;
  contextAwareTranslate: boolean;
  contextWindowSize: string;
  forceBatch: boolean;
  autoStart: boolean;
  skipIfExists: boolean;
  googleApiKey: string;
};

function resolveSourceLanguageSelect(value: string) {
  const normalized = value.trim() || 'auto';
  if (SOURCE_LANGUAGE_OPTIONS.some(item => item.value === normalized && item.value !== 'custom')) {
    return { select: normalized, custom: '' };
  }
  return { select: 'custom', custom: normalized };
}

function toFormState(settings: AppSettings): FormState {
  const source = resolveSourceLanguageSelect(settings.sourceLanguage);
  return {
    watchDirsText: settings.watchDirs.join('\n'),
    filenamePattern: settings.filenamePattern,
    sourceLanguage: source.select,
    sourceLanguageCustom: source.custom,
    targetLanguage: settings.targetLanguage,
    outputSuffixTemplate: settings.outputSuffixTemplate,
    debounceMs: String(settings.debounceMs),
    queueConcurrency: String(settings.queueConcurrency),
    batchGapMs: String(settings.batchGapMs),
    contextAwareTranslate: settings.contextAwareTranslate,
    contextWindowSize: String(settings.contextWindowSize),
    forceBatch: settings.forceBatch,
    autoStart: settings.autoStart,
    skipIfExists: settings.skipIfExists,
    googleApiKey: settings.googleApiKey,
  };
}

function toPayload(form: FormState): Partial<AppSettings> {
  const sourceLanguage =
    form.sourceLanguage === 'custom'
      ? form.sourceLanguageCustom.trim() || 'auto'
      : form.sourceLanguage;

  return {
    watchDirs: form.watchDirsText
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean),
    filenamePattern: form.filenamePattern.trim(),
    sourceLanguage,
    targetLanguage: form.targetLanguage.trim(),
    outputSuffixTemplate: form.outputSuffixTemplate.trim(),
    debounceMs: Number(form.debounceMs),
    queueConcurrency: Number(form.queueConcurrency),
    batchGapMs: Number(form.batchGapMs),
    contextAwareTranslate: form.contextAwareTranslate,
    contextWindowSize: Number(form.contextWindowSize),
    forceBatch: form.forceBatch,
    autoStart: form.autoStart,
    skipIfExists: form.skipIfExists,
    googleApiKey: form.googleApiKey,
  };
}

export default function SettingsPage() {
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  const { loading, error, refresh } = useRequest(async () => {
    const settings = await fetchSettings();
    setForm(toFormState(settings));
    return settings;
  });
  async function handleSave() {
    if (!form) return;

    try {
      setSaving(true);
      const saved = await updateSettings(toPayload(form));
      setForm(toFormState(saved));
      toaster.success({ title: '设置已保存' });
      refresh();
    } catch (err) {
      toaster.error({
        title: '保存失败',
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Stack gap={6}>
      <Flex justify="space-between" align="center" gap={3} flexWrap="wrap">
        <Heading size="lg">Settings</Heading>
        <HStack gap={2}>
          <Button variant="outline" onClick={refresh} disabled={loading || saving}>
            重新加载
          </Button>
          <Button colorPalette="blue" onClick={handleSave} loading={saving} disabled={!form}>
            保存
          </Button>
        </HStack>
      </Flex>

      {error ? (
        <Card.Root>
          <Card.Body>
            <Text color="fg.error">配置加载失败：{error.message}</Text>
          </Card.Body>
        </Card.Root>
      ) : null}

      <Card.Root>
        <Card.Body>
          {!form ? (
            <Text color="fg.muted">{loading ? '加载中…' : '暂无配置'}</Text>
          ) : (
            <Stack gap={5}>
              <Field.Root>
                <Field.Label>监听目录（每行一个）</Field.Label>
                <Textarea
                  rows={4}
                  value={form.watchDirsText}
                  onChange={event => setForm({ ...form, watchDirsText: event.target.value })}
                  placeholder={'/media\n/Users/you/Movies'}
                />
                <Field.HelperText>保存后若开启自动启动，会自动重启 watcher。</Field.HelperText>
              </Field.Root>

              <Field.Root>
                <Field.Label>字幕文件名正则</Field.Label>
                <Input
                  value={form.filenamePattern}
                  onChange={event => setForm({ ...form, filenamePattern: event.target.value })}
                  placeholder={String.raw`.*\.(srt|ass|ssa)$`}
                  fontFamily="mono"
                />
                <Field.HelperText>
                  对文件名（basename）做不区分大小写匹配；留空表示匹配全部
                  .srt/.ass/.ssa。例如只吃英语字幕：
                  {String.raw`.*\.(eng|en)\.(srt|ass|ssa)$`}
                </Field.HelperText>
              </Field.Root>

              <Field.Root>
                <Field.Label>原语言</Field.Label>
                <NativeSelect.Root>
                  <NativeSelect.Field
                    value={form.sourceLanguage}
                    onChange={event =>
                      setForm({
                        ...form,
                        sourceLanguage: event.target.value,
                      })
                    }
                  >
                    {SOURCE_LANGUAGE_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
                {form.sourceLanguage === 'custom' ? (
                  <Input
                    mt={2}
                    value={form.sourceLanguageCustom}
                    onChange={event =>
                      setForm({ ...form, sourceLanguageCustom: event.target.value })
                    }
                    placeholder="例如 ja / en / pt"
                    fontFamily="mono"
                  />
                ) : null}
                <Field.HelperText>
                  默认自动检测。日文字幕建议选「日语」，可减少误判。
                </Field.HelperText>
              </Field.Root>

              <Field.Root>
                <Field.Label>目标语言</Field.Label>
                <Input
                  value={form.targetLanguage}
                  onChange={event => setForm({ ...form, targetLanguage: event.target.value })}
                  placeholder="zh-CN"
                />
                <Field.HelperText>例如 zh-CN、en、ja。</Field.HelperText>
              </Field.Root>

              <Field.Root>
                <Field.Label>输出后缀模板</Field.Label>
                <Input
                  value={form.outputSuffixTemplate}
                  onChange={event => setForm({ ...form, outputSuffixTemplate: event.target.value })}
                  placeholder=".{lang}"
                />
                <Field.HelperText>
                  {'`{lang}` 会被替换为目标语言短码，例如 Frieren.ass → Frieren.zh.ass。'}
                </Field.HelperText>
              </Field.Root>

              <Field.Root>
                <Flex justify="space-between" align="center" gap={4}>
                  <Stack gap={0}>
                    <Field.Label mb={0}>对白上下文合并</Field.Label>
                    <Field.HelperText mt={1}>
                      开启后对每句带上前文（重叠滑动窗口）再翻译，只保留当前句结果，通常更通顺，但更慢、更易触发限流。默认开启。
                    </Field.HelperText>
                  </Stack>
                  <Switch.Root
                    checked={form.contextAwareTranslate}
                    onCheckedChange={details =>
                      setForm({ ...form, contextAwareTranslate: details.checked })
                    }
                  >
                    <Switch.HiddenInput />
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                  </Switch.Root>
                </Flex>
              </Field.Root>

              <Field.Root>
                <Field.Label>上下文窗口大小（句）</Field.Label>
                <Input
                  type="number"
                  min={1}
                  max={40}
                  value={form.contextWindowSize}
                  disabled={!form.contextAwareTranslate}
                  onChange={event => setForm({ ...form, contextWindowSize: event.target.value })}
                />
                <Field.HelperText>
                  焦点句前面最多保留多少句作为上下文，默认
                  6（含当前句）。仅在开启「对白上下文合并」时生效。
                </Field.HelperText>
              </Field.Root>

              <Field.Root>
                <Flex justify="space-between" align="center" gap={4}>
                  <Stack gap={0}>
                    <Field.Label mb={0}>强制 Batch 端点</Field.Label>
                    <Field.HelperText mt={1}>
                      关闭（默认）走更准确的 single 端点；开启更抗限流，但翻译质量通常更差。
                    </Field.HelperText>
                  </Stack>
                  <Switch.Root
                    checked={form.forceBatch}
                    onCheckedChange={details => setForm({ ...form, forceBatch: details.checked })}
                  >
                    <Switch.HiddenInput />
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                  </Switch.Root>
                </Flex>
              </Field.Root>

              <Field.Root>
                <Field.Label>Debounce（毫秒）</Field.Label>
                <Input
                  type="number"
                  min={100}
                  value={form.debounceMs}
                  onChange={event => setForm({ ...form, debounceMs: event.target.value })}
                />
                <Field.HelperText>
                  同一文件连续变更时的合并等待时间，建议 500–1500。
                </Field.HelperText>
              </Field.Root>

              <Field.Root>
                <Field.Label>队列并发数</Field.Label>
                <Input
                  type="number"
                  min={1}
                  max={32}
                  value={form.queueConcurrency}
                  onChange={event => setForm({ ...form, queueConcurrency: event.target.value })}
                />
                <Field.HelperText>
                  同时处理的翻译任务数，默认 1。提高可加快吞吐，但更容易触发免费翻译限流。
                </Field.HelperText>
              </Field.Root>

              <Field.Root>
                <Field.Label>批次间隔（毫秒）</Field.Label>
                <Input
                  type="number"
                  min={0}
                  max={60000}
                  value={form.batchGapMs}
                  onChange={event => setForm({ ...form, batchGapMs: event.target.value })}
                />
                <Field.HelperText>
                  同一任务内相邻翻译请求之间的等待时间，默认 400。设为 0 表示不等待。
                </Field.HelperText>
              </Field.Root>

              <Field.Root>
                <Flex justify="space-between" align="center" gap={4}>
                  <Stack gap={0}>
                    <Field.Label mb={0}>自动启动监听</Field.Label>
                    <Field.HelperText mt={1}>服务启动后自动开始 watching。</Field.HelperText>
                  </Stack>
                  <Switch.Root
                    checked={form.autoStart}
                    onCheckedChange={details => setForm({ ...form, autoStart: details.checked })}
                  >
                    <Switch.HiddenInput />
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                  </Switch.Root>
                </Flex>
              </Field.Root>

              <Field.Root>
                <Flex justify="space-between" align="center" gap={4}>
                  <Stack gap={0}>
                    <Field.Label mb={0}>目标文件已存在时跳过</Field.Label>
                    <Field.HelperText mt={1}>
                      发现字幕时若输出文件已存在，则标记 SKIPPED。
                    </Field.HelperText>
                  </Stack>
                  <Switch.Root
                    checked={form.skipIfExists}
                    onCheckedChange={details => setForm({ ...form, skipIfExists: details.checked })}
                  >
                    <Switch.HiddenInput />
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                  </Switch.Root>
                </Flex>
              </Field.Root>

              <Field.Root>
                <Field.Label>Google Translate API Key（可选）</Field.Label>
                <Input
                  type="password"
                  value={form.googleApiKey}
                  onChange={event => setForm({ ...form, googleApiKey: event.target.value })}
                  placeholder="当前免费接口可不填"
                />
                <Field.HelperText>
                  MVP 使用免费接口，无需 Key；此字段先保留便于后续扩展。
                </Field.HelperText>
              </Field.Root>
            </Stack>
          )}
        </Card.Body>
      </Card.Root>
    </Stack>
  );
}
