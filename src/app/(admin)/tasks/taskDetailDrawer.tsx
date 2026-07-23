'use client';

import { Badge, Box, Button, Drawer, Heading, HStack, Portal, Stack, Text } from '@chakra-ui/react';

import { formatTaskDuration, formatTaskTime, taskStatusColor } from '@/com/taskFormat';
import type { TaskItem } from '@/service/types';

type TaskDetailDrawerProps = {
  task: TaskItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRetry: (task: TaskItem) => void;
  onDelete: (task: TaskItem) => void;
  acting?: boolean;
};

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Text color="fg.muted" fontSize="sm">
        {label}
      </Text>
      <Text mt={1} whiteSpace="pre-wrap" wordBreak="break-all">
        {value || '-'}
      </Text>
    </Box>
  );
}

export function TaskDetailDrawer({
  task,
  open,
  onOpenChange,
  onRetry,
  onDelete,
  acting = false,
}: TaskDetailDrawerProps) {
  return (
    <Drawer.Root
      open={open}
      onOpenChange={details => onOpenChange(details.open)}
      size="md"
      placement="end"
    >
      <Portal>
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content>
            <Drawer.Header>
              <Drawer.Title>任务详情</Drawer.Title>
              <Drawer.CloseTrigger />
            </Drawer.Header>
            <Drawer.Body>
              {!task ? (
                <Text color="fg.muted">未选择任务</Text>
              ) : (
                <Stack gap={4}>
                  <HStack justify="space-between" align="flex-start">
                    <Heading size="sm">{task.filename}</Heading>
                    <Badge colorPalette={taskStatusColor(task.status)}>{task.status}</Badge>
                  </HStack>
                  <DetailRow label="路径" value={task.path} />
                  <DetailRow label="语言" value={task.language || '-'} />
                  <DetailRow label="进度" value={`${Math.round(task.progress)}%`} />
                  <DetailRow label="开始时间" value={formatTaskTime(task.startedAt)} />
                  <DetailRow label="结束时间" value={formatTaskTime(task.finishedAt)} />
                  <DetailRow
                    label="耗时"
                    value={formatTaskDuration(task.startedAt, task.finishedAt)}
                  />
                  <DetailRow label="Hash" value={task.hash || '-'} />
                  <DetailRow label="错误信息" value={task.error || '-'} />
                  <DetailRow label="创建时间" value={formatTaskTime(task.createdAt)} />
                  <DetailRow label="更新时间" value={formatTaskTime(task.updatedAt)} />
                </Stack>
              )}
            </Drawer.Body>
            <Drawer.Footer>
              <HStack gap={2} w="full" justify="flex-end">
                <Button
                  variant="outline"
                  disabled={!task || acting}
                  onClick={() => task && onRetry(task)}
                >
                  Retry
                </Button>
                <Button
                  colorPalette="red"
                  disabled={!task || acting}
                  onClick={() => task && onDelete(task)}
                >
                  Delete
                </Button>
              </HStack>
            </Drawer.Footer>
          </Drawer.Content>
        </Drawer.Positioner>
      </Portal>
    </Drawer.Root>
  );
}
