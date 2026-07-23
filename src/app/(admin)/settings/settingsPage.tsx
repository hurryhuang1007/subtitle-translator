'use client';

import {
  Button,
  Card,
  Field,
  Flex,
  Heading,
  HStack,
  Input,
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

type FormState = {
  watchDirsText: string;
  filenamePattern: string;
  targetLanguage: string;
  outputSuffixTemplate: string;
  debounceMs: string;
  queueConcurrency: string;
  batchGapMs: string;
  autoStart: boolean;
  skipIfExists: boolean;
  googleApiKey: string;
};

function toFormState(settings: AppSettings): FormState {
  return {
    watchDirsText: settings.watchDirs.join('\n'),
    filenamePattern: settings.filenamePattern,
    targetLanguage: settings.targetLanguage,
    outputSuffixTemplate: settings.outputSuffixTemplate,
    debounceMs: String(settings.debounceMs),
    queueConcurrency: String(settings.queueConcurrency),
    batchGapMs: String(settings.batchGapMs),
    autoStart: settings.autoStart,
    skipIfExists: settings.skipIfExists,
    googleApiKey: settings.googleApiKey,
  };
}

function toPayload(form: FormState): Partial<AppSettings> {
  return {
    watchDirs: form.watchDirsText
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean),
    filenamePattern: form.filenamePattern.trim(),
    targetLanguage: form.targetLanguage.trim(),
    outputSuffixTemplate: form.outputSuffixTemplate.trim(),
    debounceMs: Number(form.debounceMs),
    queueConcurrency: Number(form.queueConcurrency),
    batchGapMs: Number(form.batchGapMs),
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
                  同一任务内相邻翻译批次之间的等待时间，默认 400。设为 0 表示不等待。
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
