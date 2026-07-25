import fetchApi from '@/util/fetchApi';

import type { ScanProgress, StatusResponse, TaskItem, TaskListResponse, TaskStatus } from './types';

/** 浏览器本地时区的「今天」起止（ISO UTC） */
export function getLocalDayRangeIso() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { from: start.toISOString(), to: end.toISOString() };
}

export function fetchStatus() {
  const { from, to } = getLocalDayRangeIso();
  return fetchApi<StatusResponse>('/api/status', {
    cache: 'no-store',
    params: { from, to },
  });
}

export function scanWatchDirs() {
  return fetchApi<ScanProgress>('/api/scan', {
    method: 'POST',
  });
}

export function fetchTasks(params?: {
  status?: TaskStatus;
  keyword?: string;
  page?: number;
  pageSize?: number;
}) {
  return fetchApi<TaskListResponse>('/api/tasks', {
    cache: 'no-store',
    params: {
      status: params?.status,
      keyword: params?.keyword,
      page: params?.page,
      pageSize: params?.pageSize,
    },
  });
}

export function fetchTask(id: string) {
  return fetchApi<TaskItem>(`/api/tasks/${id}`, { cache: 'no-store' });
}

export function retryTask(id: string) {
  return fetchApi<TaskItem>('/api/tasks/retry', {
    method: 'POST',
    data: { id },
  });
}

export function retryFailedTasks() {
  return fetchApi<{ count: number }>('/api/tasks/retry', {
    method: 'POST',
    data: { allFailed: true },
  });
}

export function deleteTask(id: string) {
  return fetchApi<null>(`/api/tasks/${id}`, {
    method: 'DELETE',
  });
}
