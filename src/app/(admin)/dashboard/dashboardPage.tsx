'use client';

import {
  Badge,
  Box,
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
import { useState } from 'react';

import { formatTaskTime, taskStatusColor } from '@/com/taskFormat';
import { toaster } from '@/com/ui/toaster';
import { updateSettings } from '@/service/settings';
import { fetchStatus } from '@/service/tasks';
import type { TaskItem } from '@/service/types';

function formatBytes(bytes: number) {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <Card.Root>
      <Card.Body>
        <Text color="fg.muted" fontSize="sm">
          {label}
        </Text>
        <Text fontSize="2xl" mt={2} fontWeight="semibold">
          {value}
        </Text>
        {hint ? (
          <Text color="fg.muted" fontSize="xs" mt={1}>
            {hint}
          </Text>
        ) : null}
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
  const { data, loading, error, refresh } = useRequest(fetchStatus, {
    pollingInterval: 3000,
    pollingWhenHidden: false,
  });

  const translationOn = data?.translationEnabled ?? false;

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

  const metrics = [
    {
      label: 'Watching',
      value: data ? (data.watching ? 'ON' : 'OFF') : '-',
      hint: data?.watching ? '目录监听中' : '未监听',
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
          <MetricCard key={item.label} label={item.label} value={item.value} hint={item.hint} />
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
