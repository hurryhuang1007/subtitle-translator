import fetchApi from '@/util/fetchApi';

import type { LogLevel, LogsResponse } from './types';

export function fetchLogs(params?: { level?: LogLevel | ''; limit?: number }) {
  return fetchApi<LogsResponse>('/api/logs', {
    cache: 'no-store',
    params: {
      level: params?.level || undefined,
      limit: params?.limit,
    },
  });
}
