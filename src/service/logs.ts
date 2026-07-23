import { requestJson } from '@/util/requestJson';

import type { LogLevel, LogsResponse } from './types';

export function fetchLogs(params?: { level?: LogLevel | ''; limit?: number }) {
  const search = new URLSearchParams();
  if (params?.level) search.set('level', params.level);
  if (params?.limit) search.set('limit', String(params.limit));
  const query = search.toString();
  return requestJson<LogsResponse>(`/api/logs${query ? `?${query}` : ''}`);
}
