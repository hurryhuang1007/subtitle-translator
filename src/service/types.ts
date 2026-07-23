export type TaskStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SKIPPED';

export type TaskItem = {
  id: string;
  path: string;
  filename: string;
  hash: string | null;
  status: TaskStatus;
  progress: number;
  language: string | null;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MemoryUsage = {
  rss: number;
  heapTotal: number;
  heapUsed: number;
  external: number;
  arrayBuffers: number;
};

export type StatusResponse = {
  watching: boolean;
  running: number;
  waiting: number;
  successToday: number;
  failedToday: number;
  memory: MemoryUsage;
  recentTasks: TaskItem[];
};

export type AppSettings = {
  watchDirs: string[];
  targetLanguage: string;
  outputSuffixTemplate: string;
  autoStart: boolean;
  skipIfExists: boolean;
  debounceMs: number;
  googleApiKey: string;
};

export type LogLevel = 'INFO' | 'WARN' | 'ERROR';

export type LogEntry = {
  level: LogLevel;
  message: string;
  time: string;
};

export type LogsResponse = {
  entries: LogEntry[];
  lines: string[];
};
