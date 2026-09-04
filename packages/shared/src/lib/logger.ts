type Level = 'debug' | 'info' | 'warn' | 'error';

function serializeValue(val: unknown): unknown {
  if (val instanceof Error) {
    const errorObj: Record<string, unknown> = {
      name: val.name,
      message: val.message,
      stack: val.stack,
    };
    const rec = val as unknown as Record<string, unknown>;
    if (typeof rec.code !== 'undefined') {
      errorObj.code = rec.code;
    }
    if (typeof rec.kind !== 'undefined') {
      errorObj.kind = rec.kind;
    }
    if (typeof rec.cause !== 'undefined') {
      errorObj.cause = serializeValue(rec.cause);
    }
    return errorObj;
  }
  if (val !== null && typeof val === 'object') {
    if (Array.isArray(val)) {
      return val.map(serializeValue);
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val)) {
      out[k] = serializeValue(v);
    }
    return out;
  }
  return val;
}

function emit(level: Level, message: string, meta?: unknown): void {
  let context: Record<string, unknown> | undefined;
  if (meta instanceof Error) {
    context = serializeValue(meta) as Record<string, unknown>;
  } else if (meta !== null && typeof meta === 'object') {
    context = serializeValue(meta) as Record<string, unknown>;
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
