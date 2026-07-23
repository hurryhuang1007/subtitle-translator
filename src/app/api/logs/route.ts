import { NextResponse } from 'next/server';

import { bootstrapServer } from '@/server/bootstrap';
import { logger, type LogLevel } from '@/server/logger/logger';

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

  return NextResponse.json({
    entries,
    lines: entries.map(item => `[${item.time}] ${item.level} ${item.message}`),
  });
}

export type LogsResponse = {
  entries: Array<{
    level: LogLevel;
    message: string;
    time: string;
  }>;
  lines: string[];
};
