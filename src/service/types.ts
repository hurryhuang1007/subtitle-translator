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
  /** 是否开始执行翻译队列（与目录监听独立） */
  translationEnabled: boolean;
  running: number;
  waiting: number;
  successToday: number;
  failedToday: number;
  memory: MemoryUsage;
  recentTasks: TaskItem[];
  scan: ScanProgress;
};

export type ScanStatus = 'idle' | 'running' | 'done' | 'error';
export type ScanPhase = 'walking' | 'ingesting' | null;

export type ScanProgress = {
  status: ScanStatus;
  phase: ScanPhase;
  dirsVisited: number;
  filesFound: number;
  processed: number;
  enqueued: number;
  skipped: number;
  unchanged: number;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
};

export type ScanResponse = ScanProgress;

export type AppSettings = {
  watchDirs: string[];
  /** 匹配字幕文件名的正则；空字符串表示匹配全部字幕扩展名 */
  filenamePattern: string;
  /** 原语言；auto 表示自动检测 */
  sourceLanguage: string;
  targetLanguage: string;
  outputSuffixTemplate: string;
  autoStart: boolean;
  /** 是否开始执行翻译队列（关闭时仍可入队） */
  translationEnabled: boolean;
  skipIfExists: boolean;
  debounceMs: number;
  /** 任务队列并发数 */
  queueConcurrency: number;
  /** 翻译批次间隔（毫秒） */
  batchGapMs: number;
  /** 机器翻译可重试错误的最大重试次数（不含首次） */
  translateMaxRetries: number;
  /** 对白上下文合并（滑动窗口/段落）——机器翻译 */
  contextAwareTranslate: boolean;
  /** 机器翻译：一次窗口大小（每批焦点句数） */
  contextWindowSize: number;
  /** 机器翻译：每批最多携带的上文句数 */
  contextPreviousSize: number;
  /** 机器翻译：单次窗口原文字符数上限 */
  contextWindowMaxChars: number;
  /** 限流/风控时是否自动缩窗重试 */
  shrinkWindowOnRateLimit: boolean;
  /** 缩窗重试次数 */
  shrinkWindowRetries: number;
  /** 缩窗窗口下限 */
  shrinkWindowMinSize: number;
  /** 缩窗上文下限 */
  shrinkPreviousMinSize: number;
  /** 是否强制使用 Google batch 端点 */
  forceBatch: boolean;
  googleApiKey: string;
  /** 是否启用 OpenAI 兼容 LLM 翻译 */
  llmEnabled: boolean;
  llmBaseUrl: string;
  llmApiKey: string;
  llmModel: string;
  llmTemperature: number;
  /** LLM：max_tokens = 输入字符数 × 该倍数，默认 3 */
  llmMaxTokensInputMultiplier: number;
  /** LLM：可重试错误的最大重试次数（不含首次） */
  llmMaxRetries: number;
  /** LLM：一次窗口大小 */
  llmContextWindowSize: number;
  /** LLM：最多上文 */
  llmContextPreviousSize: number;
  /** LLM：单次窗口原文字符数上限 */
  llmContextWindowMaxChars: number;
  /** LLM 失败时是否仅对失败窗口回退机器翻译（受 llmFallbackToMachine 控制） */
  llmFallbackFailedWindowToMachine: boolean;
  /** LLM 不可用时是否回退机器翻译 */
  llmFallbackToMachine: boolean;
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
