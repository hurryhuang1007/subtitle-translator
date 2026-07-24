'use client';

import {
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Heading,
  HStack,
  SimpleGrid,
  Stack,
  Switch,
  Text,
} from '@chakra-ui/react';
import { useRequest } from 'ahooks';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { formatTaskTime, taskStatusColor } from '@/com/taskFormat';
import { toaster } from '@/com/ui/toaster';
import { updateSettings } from '@/service/settings';
import { fetchStatus, scanWatchDirs } from '@/service/tasks';
import type { TaskItem } from '@/service/types';

function formatBytes(bytes: number) {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

function MetricCard({
  label,
  value,
  hint,
  action,
}: {
  label: string;
  value: string | number;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <Card.Root h="full">
      <Card.Body>
        <Flex align="center" justify="space-between" gap={4} h="full">
          <Box minW={0}>
            <Text color="fg.muted" fontSize="sm">
              {label}
            </Text>
            <Text fontSize="2xl" mt={2} fontWeight="semibold" lineHeight="shorter">
              {value}
            </Text>
            {hint ? (
              <Text color="fg.muted" fontSize="xs" mt={1}>
                {hint}
              </Text>
            ) : null}
          </Box>
          {action ? <Box flexShrink={0}>{action}</Box> : null}
        </Flex>
      </Card.Body>
    </Card.Root>
  );
}

function RecentTaskRow({ task }: { task: TaskItem }) {
  return (
    <Flex
      justify="space-between"
      align={{ base: 'flex-start', md: 'center' }}
      direction={{ base: 'column', md: 'row' }}
      gap={2}
      py={3}
      borderBottomWidth="1px"
      borderColor="border.subtle"
    >
      <Box minW={0}>
        <Text fontWeight="medium" truncate>
          {task.filename}
        </Text>
        <Text color="fg.muted" fontSize="sm" truncate>
          {task.path}
        </Text>
      </Box>
      <HStack gap={3} flexShrink={0}>
        <Badge colorPalette={taskStatusColor(task.status)}>{task.status}</Badge>
        <Text color="fg.muted" fontSize="sm" whiteSpace="nowrap">
          {formatTaskTime(task.updatedAt)}
        </Text>
      </HStack>
    </Flex>
  );
}

export default function DashboardPage() {
  const [toggling, setToggling] = useState(false);
  const [startingScan, setStartingScan] = useState(false);
  const lastScanStatus = useRef<string | null>(null);
  const { data, loading, error, refresh } = useRequest(fetchStatus, {
    pollingInterval: 3000,
    pollingWhenHidden: false,
  });

  const translationOn = data?.translationEnabled ?? false;
  const watching = data?.watching ?? false;
  const scan = data?.scan;
  const scanRunning = scan?.status === 'running' || startingScan;

  useEffect(() => {
    const status = scan?.status ?? null;
    const prev = lastScanStatus.current;
    lastScanStatus.current = status;

    if (prev === 'running' && status === 'done' && scan) {
      toaster.success({
        title: '扫描完成',
        description: `发现 ${scan.filesFound} 个字幕，新入队 ${scan.enqueued}，跳过 ${scan.skipped}，未变 ${scan.unchanged}`,
      });
      void refresh();
    }

    if (prev === 'running' && status === 'error') {
      toaster.error({
        title: '扫描失败',
        description: scan?.error || '未知错误',
      });
    }
  }, [scan, refresh]);

  async function handleTranslationToggle(checked: boolean) {
    try {
      setToggling(true);
      await updateSettings({ translationEnabled: checked });
      await refresh();
      toaster.success({
        title: checked ? '已开始翻译' : '已暂停翻译',
        description: checked ? '队列开始消费等待中的任务' : '新文件仍会入队，但不会开始执行',
      });
    } catch (err) {
      toaster.error({
        title: '切换失败',
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setToggling(false);
    }
  }

  async function handleScan() {
    try {
      setStartingScan(true);
      await scanWatchDirs();
      await refresh();
      toaster.success({
        title: '已开始手动扫描',
        description: '正在后台深度扫描，进度会显示在 Watching 卡片上',
      });
    } catch (err) {
      toaster.error({
        title: '无法开始扫描',
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setStartingScan(false);
    }
  }

  function watchingHint() {
    if (!data) return undefined;
    if (scan?.status === 'running') {
      if (scan.phase === 'walking') {
        return `扫描中 · 已遍历 ${scan.dirsVisited} 目录，发现 ${scan.filesFound} 个字幕`;
      }
      return `入库中 · ${scan.processed}/${scan.filesFound}（新入队 ${scan.enqueued}）`;
    }
    if (watching) return '目录监听中';
    if (scan?.status === 'done') {
      return `上次扫描：发现 ${scan.filesFound}，入队 ${scan.enqueued}`;
    }
    if (scan?.status === 'error') return `上次扫描失败：${scan.error}`;
    return '未监听';
  }

  const metrics = [
    {
      label: 'Watching',
      value: data ? (watching ? 'ON' : 'OFF') : '-',
      hint: watchingHint(),
      action: data ? (
        <Button
          size="sm"
          variant="outline"
          loading={scanRunning}
          disabled={scanRunning}
          onClick={() => void handleScan()}
        >
          {scanRunning ? '扫描中' : '手动扫描'}
        </Button>
      ) : undefined,
    },
    { label: 'Running', value: data?.running ?? '-', hint: '正在翻译' },
    { label: 'Waiting', value: data?.waiting ?? '-', hint: '队列等待' },
    { label: 'Success Today', value: data?.successToday ?? '-', hint: '今日成功' },
    { label: 'Failed Today', value: data?.failedToday ?? '-', hint: '今日失败' },
    {
      label: 'Memory',
      value: data ? formatBytes(data.memory.heapUsed) : '-',
      hint: data ? `RSS ${formatBytes(data.memory.rss)}` : '堆内存',
    },
  ];

  return (
    <Stack gap={6}>
      <Flex justify="space-between" align="center" gap={3} flexWrap="wrap">
        <Heading size="lg">Dashboard</Heading>
        <HStack gap={4}>
          <HStack gap={3}>
            <Text fontSize="sm" fontWeight="medium">
              开始翻译
            </Text>
            <Switch.Root
              checked={translationOn}
              disabled={!data || toggling}
              onCheckedChange={details => {
                void handleTranslationToggle(details.checked);
              }}
            >
              <Switch.HiddenInput />
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
            </Switch.Root>
          </HStack>
          <Text color="fg.muted" fontSize="sm">
            {loading && !data ? '加载中…' : '每 3 秒自动刷新'}
          </Text>
        </HStack>
      </Flex>

      {error ? (
        <Card.Root>
          <Card.Body>
            <Text color="fg.error">状态加载失败：{error.message}</Text>
          </Card.Body>
        </Card.Root>
      ) : null}

      <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} gap={4}>
        {metrics.map(item => (
          <MetricCard
            key={item.label}
            label={item.label}
            value={item.value}
            hint={item.hint}
            action={item.action}
          />
        ))}
      </SimpleGrid>

      <Card.Root>
        <Card.Header>
          <Heading size="md">最近翻译</Heading>
        </Card.Header>
        <Card.Body pt={0}>
          {!data?.recentTasks?.length ? (
            <Text color="fg.muted" py={4}>
              暂无任务。把字幕放到监听目录后会入队；开启「开始翻译」后才会执行。
            </Text>
          ) : (
            <Stack gap={0}>
              {data.recentTasks.map(task => (
                <RecentTaskRow key={task.id} task={task} />
              ))}
            </Stack>
          )}
        </Card.Body>
      </Card.Root>
    </Stack>
  );
}
