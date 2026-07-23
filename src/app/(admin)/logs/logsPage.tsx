'use client';

import {
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Heading,
  HStack,
  NativeSelect,
  Stack,
  Switch,
  Text,
} from '@chakra-ui/react';
import { useRequest } from 'ahooks';
import { useLayoutEffect, useRef, useState } from 'react';

import { fetchLogs } from '@/service/logs';
import type { LogEntry, LogLevel } from '@/service/types';

const LEVEL_OPTIONS: Array<{ label: string; value: '' | LogLevel }> = [
  { label: '全部等级', value: '' },
  { label: 'INFO', value: 'INFO' },
  { label: 'WARN', value: 'WARN' },
  { label: 'ERROR', value: 'ERROR' },
];

function levelColor(level: LogLevel) {
  switch (level) {
    case 'ERROR':
      return 'red';
    case 'WARN':
      return 'yellow';
    default:
      return 'blue';
  }
}

function LogLine({ entry }: { entry: LogEntry }) {
  return (
    <Flex gap={3} py={1} align="flex-start" fontFamily="mono" fontSize="sm">
      <Text color="fg.muted" flexShrink={0}>
        {new Date(entry.time).toLocaleTimeString('zh-CN', { hour12: false })}
      </Text>
      <Badge colorPalette={levelColor(entry.level)} flexShrink={0}>
        {entry.level}
      </Badge>
      <Text whiteSpace="pre-wrap" wordBreak="break-word">
        {entry.message}
      </Text>
    </Flex>
  );
}

export default function LogsPage() {
  const [level, setLevel] = useState<'' | LogLevel>('');
  const [autoScroll, setAutoScroll] = useState(true);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const { data, loading, error, refresh } = useRequest(
    () => fetchLogs({ level: level || undefined, limit: 400 }),
    {
      refreshDeps: [level],
      pollingInterval: 2000,
      pollingWhenHidden: false,
    }
  );

  const entries = data?.entries ?? [];

  useLayoutEffect(() => {
    if (!autoScroll) return;
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [entries.length, autoScroll, level]);

  return (
    <Stack gap={6}>
      <Flex justify="space-between" align="center" gap={3} flexWrap="wrap">
        <Heading size="lg">Logs</Heading>
        <Text color="fg.muted" fontSize="sm">
          {loading && !data ? '加载中…' : `共 ${entries.length} 条 · 每 2 秒刷新`}
        </Text>
      </Flex>

      <Card.Root>
        <Card.Body>
          <Flex gap={3} direction={{ base: 'column', md: 'row' }} align={{ md: 'center' }}>
            <NativeSelect.Root maxW={{ md: '180px' }}>
              <NativeSelect.Field
                value={level}
                onChange={event => setLevel(event.target.value as '' | LogLevel)}
              >
                {LEVEL_OPTIONS.map(option => (
                  <option key={option.label} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect.Field>
              <NativeSelect.Indicator />
            </NativeSelect.Root>

            <HStack gap={3}>
              <Text fontSize="sm" color="fg.muted">
                自动滚动
              </Text>
              <Switch.Root
                checked={autoScroll}
                onCheckedChange={details => setAutoScroll(details.checked)}
              >
                <Switch.HiddenInput />
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch.Root>
            </HStack>

            <Button variant="outline" onClick={refresh}>
              刷新
            </Button>
            <Button
              variant="ghost"
              onClick={() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' })}
            >
              跳到底部
            </Button>
          </Flex>
        </Card.Body>
      </Card.Root>

      {error ? (
        <Card.Root>
          <Card.Body>
            <Text color="fg.error">日志加载失败：{error.message}</Text>
          </Card.Body>
        </Card.Root>
      ) : null}

      <Card.Root>
        <Card.Body p={0}>
          <Box maxH="70vh" overflowY="auto" px={4} py={3} bg="bg.muted">
            {entries.length === 0 ? (
              <Text color="fg.muted" py={8} textAlign="center">
                暂无日志
              </Text>
            ) : (
              <Stack gap={0}>
                {entries.map((entry, index) => (
                  <LogLine key={`${entry.time}-${index}`} entry={entry} />
                ))}
                <div ref={bottomRef} />
              </Stack>
            )}
          </Box>
        </Card.Body>
      </Card.Root>
    </Stack>
  );
}
