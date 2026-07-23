import type { TaskStatus } from '@/service/types';

export function formatTaskTime(value: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

export function formatTaskDuration(startedAt: string | null, finishedAt: string | null) {
  if (!startedAt || !finishedAt) return '-';
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '-';
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remain = Math.round(seconds % 60);
  return `${minutes}m ${remain}s`;
}

export function taskStatusColor(status: TaskStatus) {
  switch (status) {
    case 'SUCCESS':
      return 'green';
    case 'FAILED':
      return 'red';
    case 'RUNNING':
      return 'blue';
    case 'PENDING':
      return 'yellow';
    case 'SKIPPED':
      return 'gray';
    default:
      return 'gray';
  }
}

export const TASK_STATUS_OPTIONS: Array<{ label: string; value: '' | TaskStatus }> = [
  { label: '全部状态', value: '' },
  { label: 'PENDING', value: 'PENDING' },
  { label: 'RUNNING', value: 'RUNNING' },
  { label: 'SUCCESS', value: 'SUCCESS' },
  { label: 'FAILED', value: 'FAILED' },
  { label: 'SKIPPED', value: 'SKIPPED' },
];
