import fetchApi from '@/util/fetchApi';

import type { AppSettings } from './types';

export function fetchSettings() {
  return fetchApi<AppSettings>('/api/settings', { cache: 'no-store' });
}

export function updateSettings(payload: Partial<AppSettings>) {
  return fetchApi<AppSettings>('/api/settings', {
    method: 'PUT',
    data: payload,
  });
}
