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
import { type ReactNode, useState } from 'react';

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
  translateMaxRetries: string;
  contextAwareTranslate: boolean;
  contextWindowSize: string;
  contextPreviousSize: string;
  contextWindowMaxChars: string;
  shrinkWindowOnRateLimit: boolean;
  shrinkWindowRetries: string;
  shrinkWindowMinSize: string;
  shrinkPreviousMinSize: string;
  forceBatch: boolean;
  autoStart: boolean;
  skipIfExists: boolean;
  googleApiKey: string;
  llmEnabled: boolean;
  llmBaseUrl: string;
  llmApiKey: string;
  llmModel: string;
  llmTemperature: string;
  llmMaxTokensInputMultiplier: string;
  llmMaxRetries: string;
  llmContextWindowSize: string;
  llmContextPreviousSize: string;
  llmContextWindowMaxChars: string;
  llmFallbackFailedWindowToMachine: boolean;
  llmFallbackToMachine: boolean;
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
    translateMaxRetries: String(settings.translateMaxRetries),
    contextAwareTranslate: settings.contextAwareTranslate,
    contextWindowSize: String(settings.contextWindowSize),
    contextPreviousSize: String(settings.contextPreviousSize),
    contextWindowMaxChars: String(settings.contextWindowMaxChars),
    shrinkWindowOnRateLimit: settings.shrinkWindowOnRateLimit,
    shrinkWindowRetries: String(settings.shrinkWindowRetries),
    shrinkWindowMinSize: String(settings.shrinkWindowMinSize),
    shrinkPreviousMinSize: String(settings.shrinkPreviousMinSize),
    forceBatch: settings.forceBatch,
    autoStart: settings.autoStart,
    skipIfExists: settings.skipIfExists,
    googleApiKey: settings.googleApiKey,
    llmEnabled: settings.llmEnabled,
    llmBaseUrl: settings.llmBaseUrl,
    llmApiKey: settings.llmApiKey,
    llmModel: settings.llmModel,
    llmTemperature: String(settings.llmTemperature),
    llmMaxTokensInputMultiplier: String(settings.llmMaxTokensInputMultiplier),
    llmMaxRetries: String(settings.llmMaxRetries),
    llmContextWindowSize: String(settings.llmContextWindowSize),
    llmContextPreviousSize: String(settings.llmContextPreviousSize),
    llmContextWindowMaxChars: String(settings.llmContextWindowMaxChars),
    llmFallbackFailedWindowToMachine: settings.llmFallbackFailedWindowToMachine,
    llmFallbackToMachine: settings.llmFallbackToMachine,
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
    translateMaxRetries: Number(form.translateMaxRetries),
    contextAwareTranslate: form.contextAwareTranslate,
    contextWindowSize: Number(form.contextWindowSize),
    contextPreviousSize: Number(form.contextPreviousSize),
    contextWindowMaxChars: Number(form.contextWindowMaxChars),
    shrinkWindowOnRateLimit: form.shrinkWindowOnRateLimit,
    shrinkWindowRetries: Number(form.shrinkWindowRetries),
    shrinkWindowMinSize: Number(form.shrinkWindowMinSize),
    shrinkPreviousMinSize: Number(form.shrinkPreviousMinSize),
    forceBatch: form.forceBatch,
    autoStart: form.autoStart,
    skipIfExists: form.skipIfExists,
    googleApiKey: form.googleApiKey,
    llmEnabled: form.llmEnabled,
    llmBaseUrl: form.llmBaseUrl.trim(),
    llmApiKey: form.llmApiKey,
    llmModel: form.llmModel.trim(),
    llmTemperature: Number(form.llmTemperature),
    llmMaxTokensInputMultiplier: Number(form.llmMaxTokensInputMultiplier),
    llmMaxRetries: Number(form.llmMaxRetries),
    llmContextWindowSize: Number(form.llmContextWindowSize),
    llmContextPreviousSize: Number(form.llmContextPreviousSize),
    llmContextWindowMaxChars: Number(form.llmContextWindowMaxChars),
    llmFallbackFailedWindowToMachine: form.llmFallbackFailedWindowToMachine,
    llmFallbackToMachine: form.llmFallbackToMachine,
  };
}

function SettingsCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card.Root>
      <Card.Header pb={2}>
        <Heading size="md">{title}</Heading>
        {description ? (
          <Text color="fg.muted" fontSize="sm" mt={1}>
            {description}
          </Text>
        ) : null}
      </Card.Header>
      <Card.Body pt={2}>
        <Stack gap={5}>{children}</Stack>
      </Card.Body>
    </Card.Root>
  );
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
    <Flex direction="column" flex="1" minH={0} overflow="hidden" gap={0}>
      <Flex
        justify="space-between"
        align="center"
        gap={3}
        flexWrap="wrap"
        flexShrink={0}
        bg="bg.subtle"
        borderBottomWidth="1px"
        borderColor="border.subtle"
        mx={{ base: -4, md: -6 }}
        px={{ base: 4, md: 6 }}
        pt={0}
        pb={3}
        mb={4}
      >
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

      <Stack gap={6} flex="1" minH={0} overflowY="auto" pb={2}>
        {error ? (
          <Card.Root>
            <Card.Body>
              <Text color="fg.error">配置加载失败：{error.message}</Text>
            </Card.Body>
          </Card.Root>
        ) : null}

        {!form ? (
          <Card.Root>
            <Card.Body>
              <Text color="fg.muted">{loading ? '加载中…' : '暂无配置'}</Text>
            </Card.Body>
          </Card.Root>
        ) : (
          <>
            <SettingsCard title="基础设置" description="监听目录、语言、输出命名与队列相关选项。">
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
                  同时处理的翻译任务数，默认 1。提高可加快吞吐，但更容易触发限流。
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
                  同一任务内相邻翻译请求之间的等待时间，默认 400。机器翻译与 LLM 共用。
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
            </SettingsCard>

            <SettingsCard
              title="机器翻译"
              description="Google 免费接口 / Cloud Translation；未启用 LLM 或 LLM 回退时使用。"
            >
              <Field.Root>
                <Field.Label>Google Cloud Translation API Key（可选）</Field.Label>
                <Input
                  type="password"
                  value={form.googleApiKey}
                  onChange={event => setForm({ ...form, googleApiKey: event.target.value })}
                  placeholder="留空则使用免费接口"
                />
                <Field.HelperText>
                  填写后走官方 Cloud Translation v2；留空继续用免费网页接口。
                </Field.HelperText>
              </Field.Root>

              <Field.Root>
                <Flex justify="space-between" align="center" gap={4}>
                  <Stack gap={0}>
                    <Field.Label mb={0}>对白上下文合并</Field.Label>
                    <Field.HelperText mt={1}>
                      机器翻译时按窗口批量翻译并携带上文消歧。默认开启。
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
                <Field.Label>一次窗口大小（句）</Field.Label>
                <Input
                  type="number"
                  min={1}
                  value={form.contextWindowSize}
                  disabled={!form.contextAwareTranslate}
                  onChange={event => setForm({ ...form, contextWindowSize: event.target.value })}
                />
                <Field.HelperText>机器翻译每批焦点句数，默认 500。</Field.HelperText>
              </Field.Root>

              <Field.Root>
                <Field.Label>最多上文（句）</Field.Label>
                <Input
                  type="number"
                  min={0}
                  value={form.contextPreviousSize}
                  disabled={!form.contextAwareTranslate}
                  onChange={event => setForm({ ...form, contextPreviousSize: event.target.value })}
                />
                <Field.HelperText>机器翻译每批最多携带上文句数，默认 100。</Field.HelperText>
              </Field.Root>

              <Field.Root>
                <Field.Label>单次最大窗口字符数量</Field.Label>
                <Input
                  type="number"
                  min={1}
                  value={form.contextWindowMaxChars}
                  disabled={!form.contextAwareTranslate}
                  onChange={event =>
                    setForm({ ...form, contextWindowMaxChars: event.target.value })
                  }
                />
                <Field.HelperText>
                  默认 4500。优先保留本次待翻译正文，达到上限时自动缩短窗口并减少上文。
                </Field.HelperText>
              </Field.Root>

              <Field.Root>
                <Field.Label>网络重试次数</Field.Label>
                <Input
                  type="number"
                  min={0}
                  max={30}
                  value={form.translateMaxRetries}
                  onChange={event => setForm({ ...form, translateMaxRetries: event.target.value })}
                />
                <Field.HelperText>
                  机器翻译遇网络/限流等可重试错误时，额外重试几次（不含首次请求），默认 5。
                </Field.HelperText>
              </Field.Root>

              <Field.Root>
                <Flex justify="space-between" align="center" gap={4}>
                  <Stack gap={0}>
                    <Field.Label mb={0}>限流时缩窗重试</Field.Label>
                    <Field.HelperText mt={1}>
                      遇到 Google 限流/风控时，自动减半窗口与上文后重试。默认开启。
                    </Field.HelperText>
                  </Stack>
                  <Switch.Root
                    checked={form.shrinkWindowOnRateLimit}
                    disabled={!form.contextAwareTranslate}
                    onCheckedChange={details =>
                      setForm({ ...form, shrinkWindowOnRateLimit: details.checked })
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
                <Field.Label>缩窗重试次数</Field.Label>
                <Input
                  type="number"
                  min={0}
                  value={form.shrinkWindowRetries}
                  disabled={!form.contextAwareTranslate || !form.shrinkWindowOnRateLimit}
                  onChange={event => setForm({ ...form, shrinkWindowRetries: event.target.value })}
                />
                <Field.HelperText>单次任务内最多缩窗几次，默认 3。</Field.HelperText>
              </Field.Root>

              <Field.Root>
                <Field.Label>窗口下限（句）</Field.Label>
                <Input
                  type="number"
                  min={1}
                  value={form.shrinkWindowMinSize}
                  disabled={!form.contextAwareTranslate || !form.shrinkWindowOnRateLimit}
                  onChange={event => setForm({ ...form, shrinkWindowMinSize: event.target.value })}
                />
                <Field.HelperText>缩窗后窗口大小不低于此值，默认 100。</Field.HelperText>
              </Field.Root>

              <Field.Root>
                <Field.Label>上文下限（句）</Field.Label>
                <Input
                  type="number"
                  min={0}
                  value={form.shrinkPreviousMinSize}
                  disabled={!form.contextAwareTranslate || !form.shrinkWindowOnRateLimit}
                  onChange={event =>
                    setForm({ ...form, shrinkPreviousMinSize: event.target.value })
                  }
                />
                <Field.HelperText>缩窗后上文句数不低于此值，默认 30。</Field.HelperText>
              </Field.Root>

              <Field.Root>
                <Flex justify="space-between" align="center" gap={4}>
                  <Stack gap={0}>
                    <Field.Label mb={0}>强制 Batch 端点</Field.Label>
                    <Field.HelperText mt={1}>
                      仅影响免费 Google 接口：关闭走更准的 single；开启更抗限流。
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
            </SettingsCard>

            <SettingsCard
              title="大语言模型"
              description="兼容 OpenAI Chat Completions（/v1/chat/completions）。启用且配置完整时优先使用。"
            >
              <Field.Root>
                <Flex justify="space-between" align="center" gap={4}>
                  <Stack gap={0}>
                    <Field.Label mb={0}>启用 LLM 翻译</Field.Label>
                    <Field.HelperText mt={1}>
                      开启后优先走 LLM；需同时填写 Base URL、API Key、模型名。
                    </Field.HelperText>
                  </Stack>
                  <Switch.Root
                    checked={form.llmEnabled}
                    onCheckedChange={details => setForm({ ...form, llmEnabled: details.checked })}
                  >
                    <Switch.HiddenInput />
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                  </Switch.Root>
                </Flex>
              </Field.Root>

              <Field.Root>
                <Field.Label>Base URL</Field.Label>
                <Input
                  value={form.llmBaseUrl}
                  disabled={!form.llmEnabled}
                  onChange={event => setForm({ ...form, llmBaseUrl: event.target.value })}
                  placeholder="https://api.openai.com/v1"
                  fontFamily="mono"
                />
                <Field.HelperText>
                  OpenAI 兼容服务根路径，例如 https://api.openai.com/v1 或第三方 /v1。勿包含
                  /chat/completions。
                </Field.HelperText>
              </Field.Root>

              <Field.Root>
                <Field.Label>API Key</Field.Label>
                <Input
                  type="password"
                  value={form.llmApiKey}
                  disabled={!form.llmEnabled}
                  onChange={event => setForm({ ...form, llmApiKey: event.target.value })}
                  placeholder="sk-..."
                />
              </Field.Root>

              <Field.Root>
                <Field.Label>模型名</Field.Label>
                <Input
                  value={form.llmModel}
                  disabled={!form.llmEnabled}
                  onChange={event => setForm({ ...form, llmModel: event.target.value })}
                  placeholder="gpt-4o-mini"
                  fontFamily="mono"
                />
              </Field.Root>

              <Field.Root>
                <Field.Label>Temperature</Field.Label>
                <Input
                  type="number"
                  min={0}
                  max={2}
                  step={0.1}
                  value={form.llmTemperature}
                  disabled={!form.llmEnabled}
                  onChange={event => setForm({ ...form, llmTemperature: event.target.value })}
                />
                <Field.HelperText>默认 0.2，越低越稳定。</Field.HelperText>
              </Field.Root>

              <Field.Root>
                <Field.Label>输出上限倍数</Field.Label>
                <Input
                  type="number"
                  min={0.1}
                  max={50}
                  step={0.1}
                  value={form.llmMaxTokensInputMultiplier}
                  disabled={!form.llmEnabled}
                  onChange={event =>
                    setForm({ ...form, llmMaxTokensInputMultiplier: event.target.value })
                  }
                />
                <Field.HelperText>
                  请求时设置 max_tokens = 本轮输入字符数 × 该倍数，默认 3。
                </Field.HelperText>
              </Field.Root>

              <Field.Root>
                <Field.Label>网络重试次数</Field.Label>
                <Input
                  type="number"
                  min={0}
                  max={30}
                  value={form.llmMaxRetries}
                  disabled={!form.llmEnabled}
                  onChange={event => setForm({ ...form, llmMaxRetries: event.target.value })}
                />
                <Field.HelperText>
                  LLM 遇网络/限流等可重试错误时，额外重试几次（不含首次请求），默认 5。
                </Field.HelperText>
              </Field.Root>

              <Field.Root>
                <Field.Label>一次窗口大小（句）</Field.Label>
                <Input
                  type="number"
                  min={1}
                  value={form.llmContextWindowSize}
                  disabled={!form.llmEnabled}
                  onChange={event => setForm({ ...form, llmContextWindowSize: event.target.value })}
                />
                <Field.HelperText>LLM 每批焦点句数，默认 30。</Field.HelperText>
              </Field.Root>

              <Field.Root>
                <Field.Label>最多上文（句）</Field.Label>
                <Input
                  type="number"
                  min={0}
                  value={form.llmContextPreviousSize}
                  disabled={!form.llmEnabled}
                  onChange={event =>
                    setForm({ ...form, llmContextPreviousSize: event.target.value })
                  }
                />
                <Field.HelperText>LLM 每批最多携带上文句数，默认 5。</Field.HelperText>
              </Field.Root>

              <Field.Root>
                <Field.Label>单次最大窗口字符数量</Field.Label>
                <Input
                  type="number"
                  min={1}
                  value={form.llmContextWindowMaxChars}
                  disabled={!form.llmEnabled}
                  onChange={event =>
                    setForm({ ...form, llmContextWindowMaxChars: event.target.value })
                  }
                />
                <Field.HelperText>
                  默认 1500。优先保留本次待翻译正文，达到上限时自动缩短窗口并减少上文。
                </Field.HelperText>
              </Field.Root>

              <Field.Root>
                <Flex justify="space-between" align="center" gap={4}>
                  <Stack gap={0}>
                    <Field.Label mb={0}>LLM 不可用时回退机器翻译</Field.Label>
                    <Field.HelperText mt={1}>
                      开启（默认）时，LLM 请求失败会回退 Google 机器翻译；关闭则任务直接失败。
                    </Field.HelperText>
                  </Stack>
                  <Switch.Root
                    checked={form.llmFallbackToMachine}
                    disabled={!form.llmEnabled}
                    onCheckedChange={details =>
                      setForm({ ...form, llmFallbackToMachine: details.checked })
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
                <Flex justify="space-between" align="center" gap={4}>
                  <Stack gap={0}>
                    <Field.Label mb={0}>仅失败窗口回退机器翻译</Field.Label>
                    <Field.HelperText mt={1}>
                      需先开启「LLM
                      不可用时回退机器翻译」。开启（默认）时，仅对失败的那个窗口用机器翻译，后续窗口继续尝试
                      LLM；关闭则 LLM 失败后整文件回退机器翻译。
                    </Field.HelperText>
                  </Stack>
                  <Switch.Root
                    checked={form.llmFallbackFailedWindowToMachine}
                    disabled={!form.llmEnabled || !form.llmFallbackToMachine}
                    onCheckedChange={details =>
                      setForm({ ...form, llmFallbackFailedWindowToMachine: details.checked })
                    }
                  >
                    <Switch.HiddenInput />
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                  </Switch.Root>
                </Flex>
              </Field.Root>
            </SettingsCard>
          </>
        )}
      </Stack>
    </Flex>
  );
}
