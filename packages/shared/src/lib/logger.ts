type Level = 'debug' | 'info' | 'warn' | 'error';

function emit(level: Level, message: string, meta?: unknown): void {
  let context: Record<string, unknown> | undefined;
  if (meta instanceof Error) {
    context = { error: meta.message, stack: meta.stack };
  } else if (meta !== null && typeof meta === 'object') {
    context = { ...(meta as Record<string, unknown>) };
  } else if (meta !== undefined) {
    context = { value: meta };
  }
  const payload = context ? { message, ...context } : { message };
  console[level === 'debug' ? 'log' : level](`[pakyaw:${level}]`, payload);
}

export const logger = {
  debug: (message: string, meta?: unknown) => emit('debug', message, meta),
  info: (message: string, meta?: unknown) => emit('info', message, meta),
  warn: (message: string, meta?: unknown) => emit('warn', message, meta),
  error: (message: string, meta?: unknown) => emit('error', message, meta),
};
