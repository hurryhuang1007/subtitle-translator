import { requestJson } from '@/util/requestJson';

import type { StatusResponse, TaskItem, TaskStatus } from './types';

export function fetchStatus() {
  return requestJson<StatusResponse>('/api/status');
}

export function fetchTasks(params?: { status?: TaskStatus; keyword?: string }) {
  const search = new URLSearchParams();
  if (params?.status) search.set('status', params.status);
  if (params?.keyword) search.set('keyword', params.keyword);
  const query = search.toString();
  return requestJson<TaskItem[]>(`/api/tasks${query ? `?${query}` : ''}`);
}

export function fetchTask(id: string) {
  return requestJson<TaskItem>(`/api/tasks/${id}`);
}

export function retryTask(id: string) {
  return requestJson<TaskItem>('/api/tasks/retry', {
    method: 'POST',
    body: JSON.stringify({ id }),
  });
}

export function deleteTask(id: string) {
  return requestJson<void>(`/api/tasks/${id}`, {
    method: 'DELETE',
  });
}
