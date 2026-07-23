export type RuntimeStatus = {
  watching: boolean;
  runningTasks: number;
  waitingTasks: number;
};

const globalForRuntimeStatus = globalThis as unknown as {
  runtimeStatus?: RuntimeStatus;
};

function getDefaultStatus(): RuntimeStatus {
  return {
    watching: false,
    runningTasks: 0,
    waitingTasks: 0,
  };
}

export function getRuntimeStatus(): RuntimeStatus {
  if (!globalForRuntimeStatus.runtimeStatus) {
    globalForRuntimeStatus.runtimeStatus = getDefaultStatus();
  }
  return globalForRuntimeStatus.runtimeStatus;
}

export function patchRuntimeStatus(patch: Partial<RuntimeStatus>) {
  const current = getRuntimeStatus();
  globalForRuntimeStatus.runtimeStatus = {
    ...current,
    ...patch,
  };
}
