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
import { ConfirmDialog } from '@/com/ui/confirmDialog';
import { toaster } from '@/com/ui/toaster';
import { Tooltip } from '@/com/ui/tooltip';
import { deleteTask, fetchTasks, retryFailedTasks, retryTask } from '@/service/tasks';
import type { TaskItem, TaskStatus } from '@/service/types';

const DEFAULT_PAGE_SIZE = 100;

type ConfirmState = { type: 'retryAll' } | { type: 'delete'; task: TaskItem } | null;

function TruncatedText({
  children,
  fontWeight,
  color,
  fontSize,
}: {
  children: string;
  fontWeight?: string;
  color?: string;
  fontSize?: string;
}) {
  return (
    <Tooltip
      content={children}
      openDelay={200}
      contentProps={{ maxW: 'min(80vw, 560px)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
    >
      <Text fontWeight={fontWeight} color={color} fontSize={fontSize} truncate cursor="default">
        {children}
      </Text>
    </Tooltip>
  );
}

export default function TasksPage() {
  const [keyword, setKeyword] = useState('');
  const debouncedKeyword = useDebounce(keyword, { wait: 300 });
  const [status, setStatus] = useState<'' | TaskStatus>('');
  const filterKey = `${debouncedKeyword.trim()}\0${status}`;
  const [paging, setPaging] = useState({ filterKey, page: 1 });
  const page = paging.filterKey === filterKey ? paging.page : 1;
  const [selected, setSelected] = useState<TaskItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [retryingAllFailed, setRetryingAllFailed] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [confirming, setConfirming] = useState(false);

  function goToPage(nextPage: number | ((current: number) => number)) {
    setPaging(prev => {
      const current = prev.filterKey === filterKey ? prev.page : 1;
      const page = typeof nextPage === 'function' ? nextPage(current) : nextPage;
      return { filterKey, page: Math.max(1, page) };
    });
  }

  const query = useMemo(
    () => ({
      keyword: debouncedKeyword.trim() || undefined,
      status: status || undefined,
      page,
      pageSize: DEFAULT_PAGE_SIZE,
    }),
    [debouncedKeyword, status, page]
  );

  const { data, loading, error, refresh } = useRequest(() => fetchTasks(query), {
    refreshDeps: [query.keyword, query.status, query.page, query.pageSize],
    pollingInterval: 4000,
    pollingWhenHidden: false,
    onSuccess(result) {
      const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
      if (page > totalPages) {
        goToPage(totalPages);
      }
    },
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

  async function executeRetryAllFailed() {
    try {
      setConfirming(true);
      setRetryingAllFailed(true);
      const result = await retryFailedTasks();
      if (result.count === 0) {
        toaster.create({ title: '当前没有失败任务', type: 'info' });
      } else {
        toaster.success({ title: `已重新入队 ${result.count} 个失败任务` });
      }
      setConfirm(null);
      refresh();
    } catch (err) {
      toaster.error({
        title: '批量重试失败',
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setConfirming(false);
      setRetryingAllFailed(false);
    }
  }

  async function executeDelete(task: TaskItem) {
    try {
      setConfirming(true);
      setActingId(task.id);
      await deleteTask(task.id);
      toaster.success({ title: `已删除: ${task.filename}` });
      if (selected?.id === task.id) {
        setDetailOpen(false);
        setSelected(null);
      }
      setConfirm(null);
      const remainingOnPage = (data?.items.length ?? 1) - 1;
      if (remainingOnPage <= 0 && page > 1) {
        goToPage(page - 1);
      } else {
        refresh();
      }
    } catch (err) {
      toaster.error({
        title: 'Delete 失败',
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setConfirming(false);
      setActingId(null);
    }
  }

  function openDetail(task: TaskItem) {
    setSelected(task);
    setDetailOpen(true);
  }

  const tasks = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageSize = data?.pageSize ?? DEFAULT_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const busy = retryingAllFailed || actingId != null;
  const displayPage = Math.min(page, totalPages);

  const confirmTitle =
    confirm?.type === 'retryAll' ? '重试全部失败' : confirm?.type === 'delete' ? '删除任务' : '';
  const confirmDescription =
    confirm?.type === 'retryAll'
      ? '确认重新入队全部失败任务？'
      : confirm?.type === 'delete'
        ? `确认删除任务「${confirm.task.filename}」？`
        : '';
  const confirmLabel = confirm?.type === 'retryAll' ? '确认重试' : '确认删除';
  const confirmColorPalette = confirm?.type === 'retryAll' ? 'orange' : 'red';

  return (
    <Flex direction="column" gap={6} flex="1" minH={0} overflow="hidden">
      <Flex justify="space-between" align="center" gap={3} flexWrap="wrap" flexShrink={0}>
        <Heading size="lg">Tasks</Heading>
        <HStack gap={2}>
          <Button
            variant="outline"
            colorPalette="orange"
            loading={retryingAllFailed}
            disabled={busy && !retryingAllFailed}
            onClick={() => setConfirm({ type: 'retryAll' })}
          >
            重试全部失败
          </Button>
          <Text color="fg.muted" fontSize="sm">
            {loading && !data ? '加载中…' : `共 ${total} 条 · 每 4 秒刷新`}
          </Text>
        </HStack>
      </Flex>

      <Card.Root flexShrink={0}>
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
            <Button variant="outline" onClick={refresh} disabled={busy}>
              刷新
            </Button>
          </Flex>
        </Card.Body>
      </Card.Root>

      {error ? (
        <Card.Root flexShrink={0}>
          <Card.Body>
            <Text color="fg.error">任务加载失败：{error.message}</Text>
          </Card.Body>
        </Card.Root>
      ) : null}

      <Card.Root flex="1" minH={0} display="flex" flexDirection="column" overflow="hidden">
        <Card.Body p={0} flex="1" minH={0} display="flex" flexDirection="column" overflow="hidden">
          <Table.ScrollArea maxW="100%" flex="1" minH={0} overflowY="auto">
            <Table.Root size="sm" stickyHeader tableLayout="fixed" w="100%">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader w="36%">文件名</Table.ColumnHeader>
                  <Table.ColumnHeader w="8%">状态</Table.ColumnHeader>
                  <Table.ColumnHeader w="12%">开始时间</Table.ColumnHeader>
                  <Table.ColumnHeader w="12%">结束时间</Table.ColumnHeader>
                  <Table.ColumnHeader w="8%">耗时</Table.ColumnHeader>
                  <Table.ColumnHeader w="14%">错误信息</Table.ColumnHeader>
                  <Table.ColumnHeader w="10%" textAlign="right">
                    操作
                  </Table.ColumnHeader>
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
                      <Table.Cell maxW={0} overflow="hidden">
                        <TruncatedText fontWeight="medium">{task.filename}</TruncatedText>
                        <TruncatedText color="fg.muted" fontSize="xs">
                          {task.path}
                        </TruncatedText>
                      </Table.Cell>
                      <Table.Cell>
                        <Badge colorPalette={taskStatusColor(task.status)}>{task.status}</Badge>
                      </Table.Cell>
                      <Table.Cell whiteSpace="nowrap">{formatTaskTime(task.startedAt)}</Table.Cell>
                      <Table.Cell whiteSpace="nowrap">{formatTaskTime(task.finishedAt)}</Table.Cell>
                      <Table.Cell whiteSpace="nowrap">
                        {formatTaskDuration(task.startedAt, task.finishedAt)}
                      </Table.Cell>
                      <Table.Cell maxW={0} overflow="hidden">
                        <TruncatedText color="fg.muted" fontSize="sm">
                          {task.error || '-'}
                        </TruncatedText>
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
                            disabled={busy && actingId !== task.id}
                            onClick={() => handleRetry(task)}
                          >
                            Retry
                          </Button>
                          <Button
                            size="xs"
                            colorPalette="red"
                            variant="outline"
                            loading={actingId === task.id}
                            disabled={busy && actingId !== task.id}
                            onClick={() => setConfirm({ type: 'delete', task })}
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

      <Flex justify="space-between" align="center" gap={3} flexWrap="wrap" flexShrink={0}>
        <Text color="fg.muted" fontSize="sm">
          第 {displayPage} / {totalPages} 页 · 每页 {pageSize} 条
        </Text>
        <HStack gap={2}>
          <Button
            size="sm"
            variant="outline"
            disabled={displayPage <= 1 || busy}
            onClick={() => goToPage(current => Math.max(1, current - 1))}
          >
            上一页
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={displayPage >= totalPages || busy}
            onClick={() => goToPage(current => current + 1)}
          >
            下一页
          </Button>
        </HStack>
      </Flex>

      <TaskDetailDrawer
        task={selected}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onRetry={handleRetry}
        onDelete={task => setConfirm({ type: 'delete', task })}
        acting={Boolean(selected && actingId === selected.id)}
      />

      <ConfirmDialog
        open={confirm != null}
        onOpenChange={open => {
          if (!open && !confirming) setConfirm(null);
        }}
        title={confirmTitle}
        description={confirmDescription}
        confirmLabel={confirmLabel}
        confirmColorPalette={confirmColorPalette}
        loading={confirming}
        onConfirm={async () => {
          if (confirm?.type === 'retryAll') {
            await executeRetryAllFailed();
          } else if (confirm?.type === 'delete') {
            await executeDelete(confirm.task);
          }
        }}
      />
    </Flex>
  );
}
