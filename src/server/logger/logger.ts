import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

export type LogLevel = 'INFO' | 'WARN' | 'ERROR';

export type LogEntry = {
  level: LogLevel;
  message: string;
  time: string;
};

const LOG_DIR = path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'app.log');

const globalForLogger = globalThis as unknown as {
  logBuffer?: LogEntry[];
  logFileHydrated?: boolean;
};

function getBuffer() {
  if (!globalForLogger.logBuffer) {
    globalForLogger.logBuffer = [];
  }
  return globalForLogger.logBuffer;
}

function formatLine(level: LogLevel, message: string) {
  const time = new Date().toISOString();
  return { level, message, time, line: `[${time}] ${level} ${message}` };
}

function parseLogLine(line: string): LogEntry | null {
  const match = /^\[(.+?)\]\s+(INFO|WARN|ERROR)\s+(.*)$/.exec(line);
  if (!match) return null;
  return {
    time: match[1] ?? '',
    level: (match[2] as LogLevel) ?? 'INFO',
    message: match[3] ?? '',
  };
}

async function write(level: LogLevel, message: string) {
  const formatted = formatLine(level, message);
  const buffer = getBuffer();
  buffer.push({ level: formatted.level, message: formatted.message, time: formatted.time });
  if (buffer.length > 1000) {
    buffer.splice(0, buffer.length - 1000);
  }

  if (level === 'ERROR') {
    console.error(formatted.line);
  } else if (level === 'WARN') {
    console.warn(formatted.line);
  } else {
    console.log(formatted.line);
  }

  try {
    await mkdir(LOG_DIR, { recursive: true });
    await appendFile(LOG_FILE, `${formatted.line}\n`, 'utf-8');
  } catch {
    // 文件写入失败不影响主流程
  }
}

export const logger = {
  info(message: string) {
    void write('INFO', message);
  },
  warn(message: string) {
    void write('WARN', message);
  },
  error(message: string) {
    void write('ERROR', message);
  },
  getRecent(limit = 300) {
    return getBuffer().slice(-limit);
  },
  async hydrateFromFile(limit = 300) {
    if (globalForLogger.logFileHydrated) return;
    globalForLogger.logFileHydrated = true;

    try {
      const content = await readFile(LOG_FILE, 'utf-8');
      const entries = content
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .slice(-limit)
        .map(parseLogLine)
        .filter((item): item is LogEntry => Boolean(item));

      const buffer = getBuffer();
      if (buffer.length === 0 && entries.length > 0) {
        buffer.push(...entries);
      }
    } catch {
      // 文件不存在时忽略
    }
  },
};
