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

export type TaskListResponse = {
  items: TaskItem[];
  total: number;
  page: number;
  pageSize: number;
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
  /** 匹配字幕文件名的正则；空字符串表示匹配全部字幕扩展名 */
  filenamePattern: string;
  /** 原语言；auto 表示自动检测 */
  sourceLanguage: string;
  targetLanguage: string;
  outputSuffixTemplate: string;
  autoStart: boolean;
  skipIfExists: boolean;
  debounceMs: number;
  /** 任务队列并发数 */
  queueConcurrency: number;
  /** 翻译批次间隔（毫秒） */
  batchGapMs: number;
  /** 对白上下文合并（滑动窗口/段落） */
  contextAwareTranslate: boolean;
  /** 一次翻译窗口大小（每批焦点句数） */
  contextWindowSize: number;
  /** 每批最多携带的上文句数 */
  contextPreviousSize: number;
  /** 是否强制使用 Google batch 端点 */
  forceBatch: boolean;
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
