import { requestJson } from '@/util/requestJson';

import type { AppSettings } from './types';

export function fetchSettings() {
  return requestJson<AppSettings>('/api/settings');
}

export function updateSettings(payload: Partial<AppSettings>) {
  return requestJson<AppSettings>('/api/settings', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}
