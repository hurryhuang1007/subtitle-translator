'use client';

import {
  Badge,
  Button,
  Card,
  Flex,
  Heading,
  HStack,
  Input,
  NativeSelect,
  Stack,
  Table,
  Text,
} from '@chakra-ui/react';
import { useDebounce, useRequest } from 'ahooks';
import { useMemo, useState } from 'react';

import { TaskDetailDrawer } from '@/app/(admin)/tasks/taskDetailDrawer';
import {
  formatTaskDuration,
  formatTaskTime,
  TASK_STATUS_OPTIONS,
  taskStatusColor,
} from '@/com/taskFormat';
import { toaster } from '@/com/ui/toaster';
import { deleteTask, fetchTasks, retryTask } from '@/service/tasks';
import type { TaskItem, TaskStatus } from '@/service/types';

export default function TasksPage() {
  const [keyword, setKeyword] = useState('');
  const debouncedKeyword = useDebounce(keyword, { wait: 300 });
  const [status, setStatus] = useState<'' | TaskStatus>('');
  const [selected, setSelected] = useState<TaskItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  const query = useMemo(
    () => ({
      keyword: debouncedKeyword.trim() || undefined,
      status: status || undefined,
    }),
    [debouncedKeyword, status]
  );

  const { data, loading, error, refresh } = useRequest(() => fetchTasks(query), {
    refreshDeps: [query.keyword, query.status],
    pollingInterval: 4000,
    pollingWhenHidden: false,
  });

  async function handleRetry(task: TaskItem) {
    try {
      setActingId(task.id);
      await retryTask(task.id);
      toaster.success({ title: `已重新入队: ${task.filename}` });
      refresh();
    } catch (err) {
      toaster.error({
        title: 'Retry 失败',
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setActingId(null);
    }
  }

  async function handleDelete(task: TaskItem) {
    const ok = window.confirm(`确认删除任务「${task.filename}」？`);
    if (!ok) return;

    try {
      setActingId(task.id);
      await deleteTask(task.id);
      toaster.success({ title: `已删除: ${task.filename}` });
      if (selected?.id === task.id) {
        setDetailOpen(false);
        setSelected(null);
      }
      refresh();
    } catch (err) {
      toaster.error({
        title: 'Delete 失败',
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setActingId(null);
    }
  }

  function openDetail(task: TaskItem) {
    setSelected(task);
    setDetailOpen(true);
  }

  const tasks = data ?? [];

  return (
    <Stack gap={6}>
      <Flex justify="space-between" align="center" gap={3} flexWrap="wrap">
        <Heading size="lg">Tasks</Heading>
        <Text color="fg.muted" fontSize="sm">
          {loading && !data ? '加载中…' : `共 ${tasks.length} 条 · 每 4 秒刷新`}
        </Text>
      </Flex>

      <Card.Root>
        <Card.Body>
          <Flex gap={3} direction={{ base: 'column', md: 'row' }}>
            <Input
              placeholder="按文件名 / 路径搜索"
              value={keyword}
              onChange={event => setKeyword(event.target.value)}
              maxW={{ md: '320px' }}
            />
            <NativeSelect.Root maxW={{ md: '200px' }}>
              <NativeSelect.Field
                value={status}
                onChange={event => setStatus(event.target.value as '' | TaskStatus)}
              >
                {TASK_STATUS_OPTIONS.map(option => (
                  <option key={option.label} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect.Field>
              <NativeSelect.Indicator />
            </NativeSelect.Root>
            <Button variant="outline" onClick={refresh}>
              刷新
            </Button>
          </Flex>
        </Card.Body>
      </Card.Root>

      {error ? (
        <Card.Root>
          <Card.Body>
            <Text color="fg.error">任务加载失败：{error.message}</Text>
          </Card.Body>
        </Card.Root>
      ) : null}

      <Card.Root>
        <Card.Body p={0}>
          <Table.ScrollArea>
            <Table.Root size="sm" stickyHeader>
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader>文件名</Table.ColumnHeader>
                  <Table.ColumnHeader>状态</Table.ColumnHeader>
                  <Table.ColumnHeader>开始时间</Table.ColumnHeader>
                  <Table.ColumnHeader>结束时间</Table.ColumnHeader>
                  <Table.ColumnHeader>耗时</Table.ColumnHeader>
                  <Table.ColumnHeader>错误信息</Table.ColumnHeader>
                  <Table.ColumnHeader textAlign="right">操作</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {tasks.length === 0 ? (
                  <Table.Row>
                    <Table.Cell colSpan={7}>
                      <Text color="fg.muted" py={6} textAlign="center">
                        暂无任务
                      </Text>
                    </Table.Cell>
                  </Table.Row>
                ) : (
                  tasks.map(task => (
                    <Table.Row key={task.id}>
                      <Table.Cell>
                        <Text fontWeight="medium">{task.filename}</Text>
                        <Text color="fg.muted" fontSize="xs" truncate maxW="280px">
                          {task.path}
                        </Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Badge colorPalette={taskStatusColor(task.status)}>{task.status}</Badge>
                      </Table.Cell>
                      <Table.Cell whiteSpace="nowrap">{formatTaskTime(task.startedAt)}</Table.Cell>
                      <Table.Cell whiteSpace="nowrap">{formatTaskTime(task.finishedAt)}</Table.Cell>
                      <Table.Cell whiteSpace="nowrap">
                        {formatTaskDuration(task.startedAt, task.finishedAt)}
                      </Table.Cell>
                      <Table.Cell>
                        <Text color="fg.muted" fontSize="sm" truncate maxW="220px">
                          {task.error || '-'}
                        </Text>
                      </Table.Cell>
                      <Table.Cell textAlign="right">
                        <HStack gap={2} justify="flex-end">
                          <Button size="xs" variant="ghost" onClick={() => openDetail(task)}>
                            详情
                          </Button>
                          <Button
                            size="xs"
                            variant="outline"
                            loading={actingId === task.id}
                            onClick={() => handleRetry(task)}
                          >
                            Retry
                          </Button>
                          <Button
                            size="xs"
                            colorPalette="red"
                            variant="outline"
                            loading={actingId === task.id}
                            onClick={() => handleDelete(task)}
                          >
                            Delete
                          </Button>
                        </HStack>
                      </Table.Cell>
                    </Table.Row>
                  ))
                )}
              </Table.Body>
            </Table.Root>
          </Table.ScrollArea>
        </Card.Body>
      </Card.Root>

      <TaskDetailDrawer
        task={selected}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onRetry={handleRetry}
        onDelete={handleDelete}
        acting={Boolean(selected && actingId === selected.id)}
      />
    </Stack>
  );
}
