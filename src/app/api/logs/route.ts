import { bootstrapServer } from '@/server/bootstrap';
import { logger } from '@/server/logger/logger';
import { apiOk } from '@/server/util/apiResponse';

export async function GET(request: Request) {
  await bootstrapServer();
  await logger.hydrateFromFile();

  const { searchParams } = new URL(request.url);
  const levelParam = searchParams.get('level');
  const limitParam = Number(searchParams.get('limit') || '300');
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 1000) : 300;

  let entries = logger.getRecent(limit);
  if (levelParam === 'INFO' || levelParam === 'WARN' || levelParam === 'ERROR') {
    entries = entries.filter(item => item.level === levelParam);
  }

  return apiOk({
    entries,
    lines: entries.map(item => `[${item.time}] ${item.level} ${item.message}`),
  });
}
