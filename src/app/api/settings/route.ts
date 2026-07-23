import { NextResponse } from 'next/server';

import { bootstrapServer } from '@/server/bootstrap';
import { getSettings, updateSettings, type AppSettings } from '@/server/config/settings';

function normalizeSettingsInput(body: Partial<AppSettings>) {
  const next: Partial<AppSettings> = {};

  if (body.watchDirs !== undefined) {
    if (!Array.isArray(body.watchDirs)) {
      throw new Error('watchDirs 必须是字符串数组');
    }
    const dirs = body.watchDirs.map(item => String(item).trim()).filter(Boolean);
    if (dirs.length === 0) {
      throw new Error('至少配置一个监听目录');
    }
    next.watchDirs = dirs;
  }

  if (body.targetLanguage !== undefined) {
    const language = String(body.targetLanguage).trim();
    if (!language) throw new Error('targetLanguage 不能为空');
    next.targetLanguage = language;
  }

  if (body.outputSuffixTemplate !== undefined) {
    const suffix = String(body.outputSuffixTemplate).trim();
    if (!suffix) throw new Error('outputSuffixTemplate 不能为空');
    next.outputSuffixTemplate = suffix;
  }

  if (body.debounceMs !== undefined) {
    const debounceMs = Number(body.debounceMs);
    if (!Number.isFinite(debounceMs) || debounceMs < 100) {
      throw new Error('debounceMs 需为不小于 100 的数字');
    }
    next.debounceMs = Math.round(debounceMs);
  }

  if (body.autoStart !== undefined) {
    next.autoStart = Boolean(body.autoStart);
  }

  if (body.skipIfExists !== undefined) {
    next.skipIfExists = Boolean(body.skipIfExists);
  }

  if (body.googleApiKey !== undefined) {
    next.googleApiKey = String(body.googleApiKey);
  }

  return next;
}

export async function GET() {
  await bootstrapServer();
  const settings = await getSettings();
  return NextResponse.json(settings);
}

export async function PUT(request: Request) {
  await bootstrapServer();

  try {
    const body = (await request.json()) as Partial<AppSettings>;
    const normalized = normalizeSettingsInput(body);
    const settings = await updateSettings(normalized);
    return NextResponse.json(settings);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ message }, { status: 400 });
  }
}
