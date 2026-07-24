import fetchApi from '@/util/fetchApi';

import type { StatusResponse, TaskItem, TaskStatus } from './types';

export function fetchStatus() {
  return fetchApi<StatusResponse>('/api/status', { cache: 'no-store' });
}

export function fetchTasks(params?: { status?: TaskStatus; keyword?: string }) {
  return fetchApi<TaskItem[]>('/api/tasks', {
    cache: 'no-store',
    params: {
      status: params?.status,
      keyword: params?.keyword,
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
